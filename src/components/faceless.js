import React from "react";
import {
    AtomicBlockUtils,
    CompositeDecorator,
    Editor,
    EditorState,
    getDefaultKeyBinding,
    Modifier,
    RichUtils,
    SelectionState,
} from "draft-js";

import 'draft-js/dist/Draft.css';
import './faceless.css';

class Faceless extends React.Component {
    constructor(props) {
        super(props);

        this.setDomEditorRef = ref => this.domEditor = ref;
        this.focus = () => this.domEditor.focus();
        this.onChange = this._onChange.bind(this);

        const decorator = new CompositeDecorator([
            {
                strategy: linkStrategy,
                component: MultiMedia,
            },
        ]);


        this.state = {
            editorState: EditorState.createEmpty(decorator),
        };

        this.handleKeyCommand = this._handleKeyCommand.bind(this);
        this.mapKeyToEditorCommand = this._mapKeyToEditorCommand.bind(this);
        this.handleBeforeInput = this._handleBeforeInput.bind(this);
        this.handleReturn = this._handleReturn.bind(this);
    }

    _handleKeyCommand(command, editorState, eventTimestamp) {
        let newEditorState = editorState;

        let selection = newEditorState.getSelection();

        if (command === 'backspace' && selection.isCollapsed()) {
            let text = newEditorState.getCurrentContent().getPlainText();
            if (pairs[text.charAt(selection.getAnchorOffset() - 1)] === text.charAt(selection.getAnchorOffset())) {
                // delete pair brackets
                newEditorState = EditorState.push(
                    newEditorState,
                    Modifier.replaceText(
                        newEditorState.getCurrentContent(),
                        selection.merge({
                            anchorOffset: selection.getAnchorOffset() - 1,
                            focusOffset: selection.getFocusOffset() + 1
                        }),
                        '',
                    ),
                    'delete-character'
                );
                this.onChange(newEditorState);
                return 'handled';
            }
            if (RichUtils.getCurrentBlockType(newEditorState) === 'paragraph') {
                // delete paragraph block
                newEditorState = RichUtils.toggleBlockType(newEditorState, 'unstyled');
            }
        }

        newEditorState = RichUtils.handleKeyCommand(newEditorState, command);
        if (newEditorState) {
            this.onChange(newEditorState);
            return 'handled';
        }
        return 'not-handled';
    }

    _mapKeyToEditorCommand(e) {
        return getDefaultKeyBinding(e);
    }

    _handleBeforeInput(character, editorState) {
        let newEditorState = editorState;
        let selection = newEditorState.getSelection();
        let contentState = newEditorState.getCurrentContent();

        if (selection.isCollapsed()) {
            // complete brackets
            let afterChar = contentState.getBlockForKey(selection.getStartKey()).getText().charAt(selection.getFocusOffset());
            if (afterChar === character) {
                if (Object.values(pairs).includes(character)) {
                    newEditorState = EditorState.forceSelection(
                        newEditorState,
                        selection.merge({
                            anchorOffset: selection.getAnchorOffset() + 1,
                            focusOffset: selection.getFocusOffset() + 1,
                        })
                    );
                    this.onChange(newEditorState);
                    return 'handled';
                }
            }

            // pair brackets
            if (pairs[character]) {
                newEditorState = EditorState.set(
                    newEditorState,
                    {
                        currentContent: Modifier.insertText(
                            contentState,
                            selection,
                            character + pairs[character],
                        ),
                        selection: selection.merge({
                            anchorOffset: selection.getAnchorOffset() + 1,
                            focusOffset: selection.getFocusOffset() + 1,
                        })
                    }
                );
                this.onChange(newEditorState);
                return 'handled';
            }
        }

        return 'not-handled';
    }

    _onChange(editorState) {
        let contentState = editorState.getCurrentContent();
        let selection = editorState.getSelection();
        let blockKey = selection.getStartKey();
        let block = contentState.getBlockForKey(blockKey);
        let text = block.getText();
        let anchorOffset = selection.getAnchorOffset();
        let focusOffset = selection.getFocusOffset();
        let newEditorState = editorState;

        // eliminate header type in a next header
        if (headerTypes.find((value) => {
            if (contentState.getKeyBefore(blockKey)) {
                return contentState.getBlockForKey(contentState.getKeyBefore(blockKey)).getType() === value && RichUtils.getCurrentBlockType(newEditorState) === value;
            }
        })) {
            newEditorState = RichUtils.toggleBlockType(
                newEditorState,
                'paragraph',
            );
        }

        // derender inline styles
        block.getInlineStyleAt(anchorOffset - 1).forEach((value) => {
            let decorator = inlineDecorators[value];
            block.findStyleRanges((metadata) => {
                return metadata.hasStyle(value);
            }, (start, end) => {
                if (anchorOffset >= start && anchorOffset <= end) {
                    newEditorState = EditorState.set(
                        newEditorState,
                        {
                            currentContent: Modifier.replaceText(
                                newEditorState.getCurrentContent(),
                                selection.merge({
                                    anchorOffset: start,
                                    focusOffset: end,
                                    isBackward: false,
                                }),
                                decorator + block.getText().slice(start, end) + decorator,
                            ),
                            selection: selection.getIsBackward() ? selection.merge({
                                anchorOffset: anchorOffset + decorator.length,
                                focusOffset: focusOffset + (focusOffset < start ? 0 : decorator.length),
                            }) : selection.merge({
                                anchorOffset: anchorOffset + decorator.length,
                                focusOffset: focusOffset + (focusOffset > end ? 2 : 1) * decorator.length,
                                isBackward: false,
                            }),
                            forceSelection: true
                        }
                    );
                }
            });
        });

        // derender links
        if (block.getEntityAt(anchorOffset - 1)) {
            let entity = contentState.getEntity(block.getEntityAt(anchorOffset - 1));
            if (entity.getType() === 'hyperlink') {
                block.findEntityRanges((metadata) => {
                    return metadata.getEntity() === block.getEntityAt(anchorOffset - 1);
                }, (start, end) => {
                    if (anchorOffset >= start && anchorOffset <= end) {
                        newEditorState = EditorState.set(
                            newEditorState,
                            {
                                currentContent: Modifier.replaceText(
                                    newEditorState.getCurrentContent(),
                                    selection.merge({
                                        anchorOffset: start,
                                        focusOffset: end,
                                        isBackward: false,
                                    }),
                                    '[' + contentState.getPlainText().slice(start, end) + '](' +
                                    entity.getData().href + (entity.getData().title ? ' "' + entity.getData().title + '")' :
                                        ')'),
                                ),
                                selection: selection.getIsBackward() ? selection.merge({
                                    anchorOffset: anchorOffset + 1,
                                    focusOffset: focusOffset + (focusOffset < start ? 0 : 1),
                                }) : selection.merge({
                                    anchorOffset: anchorOffset + 1,
                                    focusOffset: focusOffset + (focusOffset > end ? (4 + entity.getData().href.length + (entity.getData().title ? (entity.getData().title.length + 3) : 0)) : 1),
                                    isBackward: false,
                                }),
                                forceSelection: true
                            }
                        );
                    }
                })
            }
        }

        if (block.getType() === 'unstyled') {
            newEditorState = RichUtils.toggleBlockType(
                newEditorState,
                'paragraph',
            );
        }

        if (!blockTypeRegex.has(RichUtils.getCurrentBlockType(newEditorState))) {
            // render block type
            for (const [key,value] of blockTypeRegex) {
                const re = new RegExp(value);
                let matchArr = re.exec(text);
                if (matchArr) {
                    let newPosition = anchorOffset - matchArr[1].length;
                    newEditorState = RichUtils.toggleBlockType(
                        newEditorState,
                        key,
                    );
                    newEditorState = EditorState.set(
                        newEditorState,
                        {
                            currentContent: Modifier.replaceText(
                                newEditorState.getCurrentContent(),
                                selection.merge({
                                    anchorOffset: matchArr.index,
                                    focusOffset: matchArr.index + matchArr[0].length,
                                }),
                                matchArr[2]
                            ),
                            selection: selection.merge({
                                anchorOffset: newPosition,
                                focusOffset: newPosition,
                            }),
                            forceSelection: true
                        }
                    );
                    break;
                }
            }
        }

        // render the inline styles
        Object.keys(inlineStyleRegex).some((key) => {
            const re = new RegExp(inlineStyleRegex[key]);
            let matchArr = re.exec(text);
            if (matchArr) {
                if (!(selection.getAnchorOffset() > matchArr.index
                    && selection.getAnchorOffset() < matchArr.index + matchArr[0].length + 1)) {
                    let newPosition = anchorOffset -
                        (anchorOffset <= matchArr.index ? 0 : (inlineDecorators[key].length * 2));
                    newEditorState = EditorState.forceSelection(
                        EditorState.push(
                            newEditorState,
                            Modifier.replaceText(
                                newEditorState.getCurrentContent(),
                                selection.merge({
                                    anchorOffset: matchArr.index,
                                    focusOffset: matchArr.index + matchArr[0].length,
                                }),
                                matchArr[1],
                                block.getInlineStyleAt(matchArr.index).add(key)
                            ),
                            'change-inline-style'
                        ),
                        selection.merge({
                            anchorOffset: newPosition,
                            focusOffset: newPosition,
                        })
                    );
                    for (const style of newEditorState.getCurrentInlineStyle().values()) {
                        newEditorState = RichUtils.toggleInlineStyle(newEditorState, style);
                    }
                }
                return true;
            } else {
                return false;
            }
        });

        // render multimedia block
        Object.keys(mediaTypeRegex).some((key) => {
            const re = new RegExp(mediaTypeRegex[key]);
            let matchArr = re.exec(text);
            if (matchArr) {
                if (!(selection.getAnchorOffset() > matchArr.index
                    && selection.getAnchorOffset() < matchArr.index + matchArr[0].length + 1)) {
                    if (key === 'hyperlink') {
                        let contentStateWithEntity = Modifier.replaceText(
                            newEditorState.getCurrentContent(),
                            selection.merge({
                                anchorOffset: matchArr.index,
                                focusOffset: matchArr.index + matchArr[0].length,
                            }),
                            matchArr[1],
                        );
                        let entityKey = contentStateWithEntity.createEntity('hyperlink', 'MUTABLE', {
                            href: matchArr[2], title: matchArr[4],
                        }).getLastCreatedEntityKey();
                        newEditorState = RichUtils.toggleLink(
                            EditorState.set(newEditorState, {
                                currentContent: contentStateWithEntity,
                            }),
                            SelectionState.createEmpty(blockKey).merge({
                                anchorOffset: matchArr.index,
                                focusOffset: matchArr.index + matchArr[1].length,
                            }),
                            entityKey,
                        );
                        newEditorState = EditorState.forceSelection(
                            newEditorState,
                            selection.merge({
                                anchorOffset: selection.getAnchorOffset() - 2 - 2 - matchArr[2].length - (matchArr[3] ? matchArr[3].length : 0),
                                focusOffset: selection.getAnchorOffset() - 2 - 2 - matchArr[2].length - (matchArr[3] ? matchArr[3].length : 0),
                            })
                        );
                        return true;
                    } else {
                        console.log(matchArr);
                        let contentStateWithEntity = Modifier.replaceText(
                            newEditorState.getCurrentContent(),
                            SelectionState.createEmpty(blockKey).merge({
                                anchorOffset: matchArr.index,
                                focusOffset: matchArr.index + matchArr[0].length,
                            }),
                            ''
                        ).createEntity(
                            key,
                            'IMMUTABLE',
                            {src: matchArr[2], alt: matchArr[1], title: matchArr[5] || ''}
                        );
                        let entityKey = contentStateWithEntity.getLastCreatedEntityKey();
                        newEditorState = EditorState.set(
                            newEditorState,
                            {currentContent: contentStateWithEntity}
                        );
                        newEditorState = AtomicBlockUtils.insertAtomicBlock(
                            newEditorState,
                            entityKey,
                            ' ',
                        );
                        return true;
                    }
                }
            } else {
                return false;
            }
        });

        this.setState({editorState: newEditorState});
    }

    _handleReturn(e, editorState) {
        let newEditorState = editorState;
        if (RichUtils.getCurrentBlockType(newEditorState) === 'blockquote') {
            if (e.ctrlKey) {
                return 'not-handled';
            }
            newEditorState = RichUtils.insertSoftNewline(newEditorState);
            this.onChange(newEditorState);
            return 'handled';
        }
        if (headerTypes.some((type) => {
            return type === RichUtils.getCurrentBlockType(newEditorState);
        })) {
            // newEditorState = RichUtils.insertSoftNewline();
        }
    }

    render() {
        return (
            <div className="editor-root">
                <div className="editor-container" onClick={this.focus}>
                    <Editor
                        editorState={this.state.editorState}
                        onChange={this.onChange}
                        ref={this.setDomEditorRef}
                        placeholder={"Write some text..."}
                        handleKeyCommand={this.handleKeyCommand}
                        keyBindingFn={this.mapKeyToEditorCommand}
                        handleBeforeInput={this.handleBeforeInput}
                        handleReturn={this.handleReturn}
                        blockRendererFn={BlockRenderer}
                    />
                </div>
            </div>
        );
    }
}

function linkStrategy(contentBlock, callback, contentState) {
    contentBlock.findEntityRanges(
        (character) => {
            const entityKey = character.getEntity();
            return (
                entityKey !== null &&
                contentState.getEntity(entityKey).getType() === 'hyperlink'
            );
        },
        callback
    );
}

function BlockRenderer(block) {
    switch (block.getType()) {
        case 'atomic':
            return {
                component: MultiMedia,
                editable: false,
            };
    }
    return null;
}

const MultiMedia = (props) => {
    let entityKey = props.entityKey || props.block.getEntityAt(0);
    const entity = props.contentState.getEntity(
        entityKey
    );
    const data = entity.getData();
    const type = entity.getType();

    let media;
    switch (type) {
        case 'image':
            media = <img alt={data.alt || ''} src={data.src} title={data.title || ''}/>;
            break;
        case 'video':
            media = <video controls muted autoPlay loop src={data.src} title={data.title || ''}/>;
            break;
        case 'hyperlink':
            media = <a href={data.href} title={data.title || ''}>
                {props.children}
            </a>;
    }
    return media;
};

const mediaTypeRegex = {
    'image': /!\[(.*?)]\((.+?(bmp|jpg|jpeg|png|gif|tif|tiff|dib|psd|raw|pxr|mac|tga|vst|pcd|pct|ai|fpx|cal|img|wi|eps|ico|cr2|crw|cur|ani).*?)(\s*"(.*)")?\)/g,
    'video': /!\[(.*?)]\((.+?(asf|avi|wm|wmp|wmv|rm|rmvb|rp|rpm|rt|smi|smil|m1v|m2p|m2t|m2ts|m2v|mp2v|mpe|mpeg|mpg|mpv2|pss|pva|tp|tpr|ts|m4b|m4p|m4v|mp4|mpeg4|3g2|3gp|3gp2|3gpp|mov|qt|f4v|flv|hlv|swf|ifo|vob|amv|bik|csf|divx|evo|ivm|mkv|mod|mts|ogm|pmp|scm|tod|vp6|webm|xlmv|asx|cue|m3u|pls|qpl).*?)(\s*"(.*)")?\)/g,
    'audio': /!\[(.*?)]\((.+?(aac|ac3|amr|ape|cda|dts|flac|m1a|m2a|m4a|mid|midi|mka|mp2|mp3|mpa|ogg|ra|tak|tta|wav|wma|wv|ram|kpl|smpl).*?)(\s*"(.*)")?\)/g,
    'hyperlink': /\[(.*?)]\((.+?)(\s*"(.*)")?\)/g,
};

const blockTypeRegex = new Map([
    ['header-one', /^(# )(.*)$/],
    ['header-two', /^(## )(.*)$/],
    ['header-three', /^(### )(.*)$/],
    ['header-four', /^(#### )(.*)$/],
    ['header-five', /^(##### )(.*)$/],
    ['header-six', /^(###### )(.*)$/],
    ['unordered-list-item', /^\s*(- )(.*)$/],
    ['ordered-list-item', /^\s*(\d. )(.*)$/],
    ['blockquote', /^\s*(> )(.*)$/],
    // 'code-block': /^```
    // 'atomic'
    // 'paragraph':
    // 'unstyled
]);

const headerTypes = [
    'header-one',
    'header-two',
    'header-three',
    'header-four',
    'header-five',
    'header-six',
]

const inlineStyleRegex = new Map([
    ['BOLD', /\*\*(.+?)\*\*/g],
    ['ITALIC', /\*(.+?)\*/g],
    ['CODE', /`(.+?)`/g],
    ['STRIKETHROUGH', /~~(.+?)~~/g],
]);



const inlineDecorators = {
    BOLD: '**',
    ITALIC: '*',
    CODE: '`',
    STRIKETHROUGH: '~~',
};

const pairs = {
    '*': '*',
    '`': '`',
    '~': '~',
    '(': ')',
    '[': ']',
    '{': '}',
    '"': '"',
    "'": "'",
    // '（': '）',
};



export default Faceless;
