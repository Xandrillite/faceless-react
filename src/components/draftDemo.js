import React from "react";
import {Editor,
    EditorState,
    RichUtils,
    getDefaultKeyBinding,
    CompositeDecorator,
    convertToRaw,
    convertFromRaw,
    SelectionState,
    Modifier,
    AtomicBlockUtils
} from 'draft-js';
import 'draft-js/dist/Draft.css';
import {Map} from 'immutable';
import katex from 'katex';
import './draftDemo.css'
import './katex.css'
import 'katex/dist/katex.css'

class MyEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = {editorState: EditorState.createEmpty()};

        this.setDomEditorRef = ref => this.domEditor = ref;
        this.focus = () => this.domEditor.focus();
        this.onChange = (editorState) => this.setState({editorState});

        this.handleKeyCommand = this.handleKeyCommand.bind(this);
        this.mapKeyToEditorCommand = this._mapKeyToEditorCommand.bind(this);
        this.toggleBlockType = this._toggleBlockType.bind(this);
        this.toggleInlineStyle = this._toggleInlineStyle.bind(this);
    }

    handleKeyCommand(command, editorState) {
        const newState = RichUtils.handleKeyCommand(editorState, command);
        if (newState) {
            this.onChange(newState);
            return true;
        }
        return false;
    }

    _mapKeyToEditorCommand(e) {
        if (e.keyCode === 9 /* TAB */) {
            const newEditorState = RichUtils.onTab(
                e,
                this.state.editorState,
                4, /* maxDepth*/
            );
            if (newEditorState !== this.state.editorState) {
                this.onChange(newEditorState);
            }
            return;
        }
        return getDefaultKeyBinding(e);
    }

    _toggleBlockType(blockType) {
        this.onChange(
            RichUtils.toggleBlockType(
                this.state.editorState,
                blockType
            )
        );
    }

    _toggleInlineStyle(inlineStyle) {
        console.log(inlineStyle);
        let newEditorState = RichUtils.toggleInlineStyle(
            this.state.editorState,
            inlineStyle
        );
        console.log(newEditorState.getSelection());
        this.onChange(newEditorState);
    }

    componentDidMount() {
        this.domEditor.focus();
    }

    render() {
        const editorState = this.state.editorState;

        // change block type before entering any text, we can
        // either style the placeholder or hide it. Now we hide it
        let className = 'RichEditor-editor';
        let contentState = editorState.getCurrentContent();
        if (!contentState.hasText()) {
            if (contentState.getBlockMap().first().getType() !== 'unstyled') {
                className += ' RichEditor-hidePlaceholder';
            }
        }

        return (
            <div className="RichEditor-root">
                <BlockStyleControls
                    editorState={editorState}
                    onToggle={this.toggleBlockType}
                />
                <InlineStyleControls
                    editorState={editorState}
                    onToggle={this.toggleInlineStyle}
                />
                <div className={className} onClick={this.focus}>
                    <Editor
                        blockStyleFn={getBlockStyle}
                        customStyleMap={styleMap}
                        editorState={this.state.editorState}
                        handleKeyCommand={this.handleKeyCommand}
                        keyBindingFn={this.mapKeyToEditorCommand}
                        onChange={this.onChange}
                        placeholder="Enter some text..."
                        ref={this.setDomEditorRef}
                        // ref="editor"
                        spellCheck={true}
                        // handleBeforeInput={handleBlockType}
                    />
                </div>
            </div>
        );
    }
}

const styleMap = {
    CODE: {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        fontFamily: '"Inconsolata", "Menlo", "Consolas", monospace',
        fontSize: 16,
        padding: 2,

    },
};

function getBlockStyle(block) {
    switch (block.getType()) {
        case 'blockquote':
            return 'RichEditor-blockquote';
        default:
            return null;
    }
}

// class StyleButton extends React.Component {
//     constructor(props) {
//         super(props);
//         this.onToggle = (e) => {
//             e.preventDefault();
//             this.props.onToggle(this.props.style);
//         };
//     }
//
//     render() {
//         let className = 'RichEditor-styleButton';
//         if (this.props.active) {
//             className += ' RichEditor-activeButton';
//         }
//
//         return (
//             <span className={className} onMouseDown={this.onToggle}>
//                 {this.props.label}
//             </span>
//         );
//     }
// }

const BLOCK_TYPES = [
    {label: 'H1', style: 'header-one'},
    {label: 'H2', style: 'header-two'},
    {label: 'H3', style: 'header-three'},
    {label: 'H4', style: 'header-four'},
    {label: 'H5', style: 'header-five'},
    {label: 'H6', style: 'header-six'},
    {label: 'Blockquote', style: 'blockquote'},
    {label: 'UL', style: 'unordered-list-item'},
    {label: 'OL', style: 'ordered-list-item'},
    {label: 'Code Block', style: 'code-block'},
];

const BlockStyleControls = (props) => {
    const {editorState} = props;
    const selection = editorState.getSelection();
    const blockType = editorState
        .getCurrentContent()
        .getBlockForKey(selection.getStartKey())
        .getType();

    return (
        <div className="RichEditor-controls">
            {BLOCK_TYPES.map((type) =>
                <StyleButton
                    key={type.label}
                    active={type.style === blockType}
                    label={type.label}
                    onToggle={props.onToggle}
                    style={type.style}
                />
            )}
        </div>
    );
};

const INLINE_STYLE = [
    {label: 'Bold', style: 'BOLD'},
    {label: 'Italic', style: 'ITALIC'},
    {label: 'Underline', style: 'UNDERLINE'},
    {label: 'Monospace', style: 'CODE'},
];

const InlineStyleControls = (props) => {
    const currentStyle = props.editorState.getCurrentInlineStyle();

    return (
        <div className="RichEditor-controls">
            {INLINE_STYLE.map((type) =>
                <StyleButton
                    key={type.label}
                    active={currentStyle.has(type.style)}
                    label={type.label}
                    onToggle={props.onToggle}
                    style={type.style}
                />
            )}
        </div>
    );
};


class LinkEditor extends React.Component {
    constructor(props) {
        super(props);

        const decorator = new CompositeDecorator([
            {
                strategy: findLinkEntities,
                component: Link,
            },
        ]);

        this.state = {
            editorState: EditorState.createEmpty(decorator),
            showURLInput: false,
            urlValue: '',
        };

        this.setDomEditorRef = ref => this.domEditor = ref;
        this.focus = () => this.domEditor.focus();
        this.onChange = (editorState) => this.setState({editorState: editorState});
        this.logState = () => {
            const content = this.state.editorState.getCurrentContent();
            console.log(convertToRaw(content));
        }

        this.promptForLink = this._promptForLink.bind(this);
        this.onURLChange = (e) => this.setState({urlValue: e.target.value})
        this.confirmLink = this._confirmLink.bind(this);
        this.onLinkInputKeyDown = this._onLinkInputKeyDown.bind(this);
        this.removeLink = this._removeLink.bind(this);
    }

    _promptForLink(e) {
        e.preventDefault();
        const {editorState} = this.state;
        const selection = editorState.getSelection();
        if (!selection.isCollapsed()) {
            const contentState = editorState.getCurrentContent();
            const startKey = editorState.getSelection().getStartKey();
            const startOffset = editorState.getSelection().getStartOffset();
            const blockWithLinkAtBeginning = contentState.getBlockForKey(startKey);
            const linkKey = blockWithLinkAtBeginning.getEntityAt(startOffset);

            let url = '';
            if (linkKey) {
                const linkInstance = contentState.getEntity(linkKey);
                url = linkInstance.getData().url;
            }

            this.setState({
                showURLInput: true,
                urlValue: url,
            }, () => {
                setTimeout(() => this.focus(), 0);
            });
        }
    }

    _confirmLink(e) {
        e.preventDefault();
        const {editorState, urlValue} = this.state;
        const contentState = editorState.getCurrentContent();
        const contentStateWithEntity = contentState.createEntity(
            'LINK',
            'MUTABLE',
            {url: urlValue}
        );
        const entityKey = contentStateWithEntity.getLastCreatedEntityKey();
        const newEditorState = EditorState.set(editorState,
            {currentContent: contentStateWithEntity})
        this.setState({
            editorState: RichUtils.toggleLink(
                newEditorState,
                newEditorState.getSelection(),
                entityKey
            ),
            showURLInput: false,
            urlValue: '',
        }, () => {
            setTimeout(() => this.focus(), 0);
        });
    }

    _onLinkInputKeyDown(e) {
        if (e.which === 13) {
            this._confirmLink(e);
        }
    }

    _removeLink(e) {
        e.preventDefault();
        const {editorState} = this.state;
        const selection = editorState.getSelection();
        if (!selection.isCollapsed()) {
            this.setState({
                editorState: RichUtils.toggleLink(editorState, selection, null),

            });
        }
    }

    render() {
        let urlInput;
        if (this.state.showURLInput) {
            urlInput =
                <div style={styles.urlInputContainer}>
                    <input
                        onChange={this.onURLChange}
                        ref={this.setDomEditorRef}
                        style={styles.urlInput}
                        type="text"
                        value={this.state.urlValue}
                        onKeyDown={this.onLinkInputKeyDown}
                    />
                    <button onMouseDown={this.confirmLink}>
                        Confirm
                    </button>
                </div>;
        }

        return (
            <div style={styles.root}>
                <div style={{marginBottom: 10}}>
                    Select some text, then use the buttons to add or remove links on the selected text.
                </div>
                <div style={styles.buttons}>
                    <button onMouseDown={this.promptForLink}
                            style={{marginRight: 10}}>
                        Add Link
                    </button>
                    <button onMouseDown={this.removeLink}>
                        Remove Link
                    </button>
                </div>
                {urlInput}
                <div style={styles.editor} onClick={this.focus}>
                    < Editor
                        editorState={this.state.editorState}
                        onChange={this.onChange}
                        placeholder="Enter some text..."
                        ref={this.setDomEditorRef}
                    />
                </div>
                <input
                    onClick={this.logState}
                    style={styles.button}
                    type="button"
                    value="Log State"
                />
            </div>
        );
    }
}

function findLinkEntities(contentBlock, callback, contentState) {
    contentBlock.findEntityRanges(
        (character) => {
            const entityKey = character.getEntity();
            return (
                entityKey !== null &&
                contentState.getEntity(entityKey).getType() === 'LINK'
            );
        },
        callback
    );
}

const Link = (props) => {
    const {url} = props.contentState.getEntity(props.entityKey).getData();
    return (
        <a href={url} style={styles.link}>
            {props.children}
        </a>
    );
};

const styles = {
    root: {
        fontFamily: '\'Georgia\', serif',
        padding: 20,
        width: 600,
    },
    buttons: {
        marginBottom: 10,
    },
    urlInputContainer: {
        marginBottom: 10,
    },
    urlInput: {
        fontFamily: '\'Georgia\', serif',
        marginRight: 10,
        padding: 3,
    },
    editor: {
        border: '1px solid #ccc',
        cursor: 'text',
        minHeight: 80,
        padding: 10,
    },
    button: {
        marginTop: 10,
        textAlign: 'center',
    },
    link: {
        color: '#3b5998',
        textDecoration: 'underline',
    },
    immutable: {
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        padding: '2px 0',
    },
    mutable: {
        backgroundColor: 'rgba(204, 204, 255, 1.0)',
        padding: '2px 0',
    },
    segmented: {
        backgroundColor: 'rgba(248, 222, 126, 1.0)',
        padding: '2px 0',
    },
    handle: {
        color: 'rgba(98, 177, 254, 1.0)',
        direction: 'ltr',
        unicodeBidi: 'bidi-override',
    },
    hashtag: {
        color: 'rgba(95, 184, 138, 1.0)',
    },
    media: {
        width: '100%',
        // Fix an issue with Firefox rendering video controls
        // with 'pre-wrap' white-space
        whiteSpace: 'initial'
    },
    controls: {
        fontFamily: '\'Helvetica\', sans-serif',
        fontSize: 14,
        marginBottom: 10,
        userSelect: 'none',
    },
    styleButton: {
        color: '#999',
        cursor: 'pointer',
        marginRight: 16,
        padding: '2px 0',
    },
};


// const rawContent = {
//     blocks: [
//         {
//             text: (
//                 'This is an "immutable" entity: Superman. Deleting any ' +
//                 'characters will delete the entire entity. Adding characters ' +
//                 'will remove the entity from the range.'
//             ),
//             type: 'unstyled',
//             entityRanges: [{offset: 31, length: 8, key: 'first'}],
//         },
//         {
//             text: '',
//             type: 'unstyled',
//         },
//         {
//             text: (
//                 'This is a "mutable" entity: Batman. Characters may be added ' +
//                 'and removed.'
//             ),
//             type: 'unstyled',
//             entityRanges: [{offset: 28, length: 6, key: 'second'}],
//         },
//         {
//             text: '',
//             type: 'unstyled',
//         },
//         {
//             text: (
//                 'This is a "segmented" entity: Green Lantern. Deleting any ' +
//                 'characters will delete the current "segment" from the range. ' +
//                 'Adding characters will remove the entire entity from the range.'
//             ),
//             type: 'unstyled',
//             entityRanges: [{offset: 30, length: 13, key: 'third'}],
//         },
//     ],
//
//     entityMap: {
//         first: {
//             type: 'TOKEN',
//             mutability: 'IMMUTABLE',
//         },
//         second: {
//             type: 'TOKEN',
//             mutability: 'MUTABLE',
//         },
//         third: {
//             type: 'TOKEN',
//             mutability: 'SEGMENTED',
//         },
//     },
// };

class EntityEditor extends React.Component {
    constructor(props) {
        super(props);

        const decorator = new CompositeDecorator([
            {
                strategy: getEntityStrategy('IMMUTABLE'),
                component: TokenSpan,
            },
            {
                strategy: getEntityStrategy('MUTABLE'),
                component: TokenSpan,
            },
            {
                strategy: getEntityStrategy('SEGMENTED'),
                component: TokenSpan,
            },
        ]);

        const blocks = convertFromRaw(rawContent);

        this.state = {
            editorState: EditorState.createWithContent(blocks, decorator),
        };

        this.setDomEditorRef = ref => this.domEditor = ref;
        this.focus = () => this.domEditor.focus();
        this.onChange = (editorState) => this.setState({editorState});
        this.logState = () => {
            const content = this.state.editorState.getCurrentContent();
            console.log(convertToRaw(content));

        };
    }

    render() {
        return (
            <div style={styles.root}>
                <div style={styles.editor} onClick={this.focus}>
                    <Editor
                        editorState={this.state.editorState}
                        onChange={this.onChange}
                        placeholder="Enter some text..."
                        ref={this.setDomEditorRef}
                    />
                </div>
                <input
                    onClick={this.logState}
                    style={styles.button}
                    type="button"
                    value="Log State"
                />
            </div>
        );
    }
}

function getEntityStrategy(mutability) {
    return function (contentBlock, callback, contentState) {
        contentBlock.findEntityRanges(
            (character) => {
                const entityKey = character.getEntity();
                if (entityKey === null) {
                    return false;
                }
                return contentState.getEntity(entityKey).getMutability() === mutability;
            },
            callback
        );
    };
}

function getDecoratedStyle(mutability) {
    switch (mutability) {
        case 'IMMUTABLE': return styles.immutable;
        case 'MUTABLE': return styles.mutable;
        case 'SEGMENTED': return styles.segmented;
        default: return null;
    }
}

const TokenSpan = (props) => {
    const style = getDecoratedStyle(
        props.contentState.getEntity(props.entityKey).getMutability()
    );
    return (
        <span data-offset-key={props.offsetKey} style={style}>
            {props.children}
        </span>
    );
};


class TweetEditor extends React.Component {
    constructor() {
        super();
        const compositeDecorator = new CompositeDecorator([
            {
                strategy: handleStrategy,
                component: HandleSpan,
            },
            {
                strategy: hashtagStrategy,
                component: HashtagSpan,
            }
        ]);

        this.state = {
            editorState: EditorState.createEmpty(compositeDecorator),
        };

        this.setDomEditor = ref => this.domEditor = ref;
        this.focus = () => this.domEditor.focus();
        this.onChange = (editorState) => this.setState({editorState});
        this.logState = () => console.log(this.state.editorState.toJS());
    }

    render() {
        return (
            <div style={styles.root}>
                <div style={styles.editor} onClick={this.focus}>
                    <Editor
                        editorState={this.state.editorState}
                        onChange={this.onChange}
                        placeholder="Write a tweet..."
                        ref={this.setDomEditor}
                        spellCheck={true}
                    />
                </div>
                <input
                    onClick={this.logState}
                    style={styles.button}
                    type="button"
                    value="Log State"
                />
            </div>
        );
    }
}

const HANDLE_REGEX = /@\w+/g;
const HASHTAG_REGEX = /#[\w\u0590-\u05ff]+/g;

function handleStrategy(contentBlock, callback, contentState) {
    findWithRegex(HANDLE_REGEX, contentBlock, callback);
}

function hashtagStrategy(contentBlock, callback, contentState) {
    findWithRegex(HASHTAG_REGEX, contentBlock, callback);
}

function findWithRegex(regex, contentBlock, callback) {
    const text = contentBlock.getText();
    let marchArr, start;
    while ((marchArr = regex.exec(text)) !== null) {
        start = marchArr.index;
        callback(start, start + marchArr[0].length);
    }
}

const HandleSpan = (props) => {
    return (
        <span
            style={styles.handle}
            data-offset-key={props.offsetKey}
        >
            {props.children}
        </span>
    );
};

const HashtagSpan = (props) => {
    return (
        <span
            style={styles.hashtag}
            data-offset-key={props.offsetKey}
        >
            {props.children}
        </span>
    );
};


class TeXEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            editorState: EditorState.createWithContent(content),
            liveTeXEdits: Map(),
        };
        this.blockRender = (block) => {
            if (block.getType() === 'atomic') {
                return {
                    component: TeXBlock,
                    editable: false,
                    props: {
                        onStartEdit: (blockKey) => {
                            let {liveTeXEdits} = this.state;
                            this.setState({liveTeXEdits: liveTeXEdits.set(blockKey, true)});
                        },
                        onFinishEdit: (blockKey, newContentState) => {
                            let {liveTeXEdits} = this.state;
                            this.setState({
                                liveTeXEdits: liveTeXEdits.remove(blockKey),
                                editorState: EditorState.createWithContent(newContentState),
                            });
                        },
                        onRemove: (blockKey) => {
                            this.removeTeX(blockKey);
                        },
                    },
                };
            }
            return null;
        };

        this.setDomEditor = ref => this.domEditor = ref;
        this.focus = () => this.domEditor.focus();
        this.onChange = (editorState) => this.setState({editorState});

        this.handleKeyCommand = (command, editorState) => {
            let newState = RichUtils.handleKeyCommand(editorState, command);
            if (newState) {
                this.onChange(newState);
                return true;
            }
            return false;
        };

        this.removeTeX = (blockKey) => {
            let {editorState, liveTeXEdits} = this.state;

            function removeTeXBlock(editorState, blockKey) {
                let content = editorState.getCurrentContent();
                let block = content.getBlockForKey(blockKey);

                let targetRange = new SelectionState({
                    anchorKey: blockKey,
                    anchorOffset: 0,
                    focusKey: blockKey,
                    focusOffset: block.getLength(),
                });

                let withoutTeX = Modifier.removeRange(content, targetRange, 'backward');
                let resetBlock = Modifier.setBlockType(
                    withoutTeX,
                    withoutTeX.getSelectionAfter(),
                    'unstyled',
                );
                let newState = EditorState.push(editorState, resetBlock, 'remove-range');
                return EditorState.forceSelection(newState, resetBlock.getSelectionAfter());
            }

            this.setState({
                liveTeXEdits: liveTeXEdits.remove(blockKey),
                editorState: removeTeXBlock(editorState, blockKey),

            });
        };

        let count = 0;
        const examples = [
            '\\int_a^bu\\frac{d^2v}{dx^2}\\,dx\n' +
            '=\\left.u\\frac{dv}{dx}\\right|_a^b\n' +
            '-\\int_a^b\\frac{du}{dx}\\frac{dv}{dx}\\,dx',

            'P(E) = {n \\choose k} p^k (1-p)^{ n-k} ',

            '\\tilde f(\\omega)=\\frac{1}{2\\pi}\n' +
            '\\int_{-\\infty}^\\infty f(x)e^{-i\\omega x}\\,dx',

            '\\frac{1}{(\\sqrt{\\phi \\sqrt{5}}-\\phi) e^{\\frac25 \\pi}} =\n' +
            '1+\\frac{e^{-2\\pi}} {1+\\frac{e^{-4\\pi}} {1+\\frac{e^{-6\\pi}}\n' +
            '{1+\\frac{e^{-8\\pi}} {1+\\ldots} } } }',
        ];

        this.insertTeX = () => {

            function insertTeXBlock(editorState) {
                const contentState = editorState.getCurrentContent();
                const nextFormula = count++ % examples.length;
                const contentStateWithEntity = contentState.createEntity(
                    'TOKEN',
                    'IMMUTABLE',
                    {content: examples[nextFormula]}
                );
                const entityKey = contentStateWithEntity.getLastCreatedEntityKey();
                const newEditorState = EditorState.set(
                    editorState,
                    {currentContent: contentStateWithEntity}
                );
                return AtomicBlockUtils.insertAtomicBlock(newEditorState, entityKey, ' ');
            }

            this.setState({
                liveTeXEdits: Map(),
                editorState: insertTeXBlock(this.state.editorState),
            });
        };

    }

    render() {
        return (
            <div className="TeXEditor-container">
                <div className="TeXEditor-root">
                    <div className="TeXEditor-editor" onClick={this.focus}>
                        <Editor editorState={this.state.editorState}
                                onChange={this.onChange}
                                blockRendererFn={this.blockRender}
                                handleKeyCommand={this.handleKeyCommand}
                                placeholder="Start a document..."
                                readOnly={this.state.liveTeXEdits.count()}
                                ref={this.setDomEditor}
                                spellCheck={true}/>
                    </div>
                </div>
                <button onClick={this.insertTeX} className="TeXEditor-insert">
                    {'Insert new TeX'}
                </button>
            </div>
        );
    }
}

class TeXBlock extends React.Component {
    constructor(props) {
        super(props);
        this.state = {editMode: false};

        this.onClick = () => {
            if (this.state.editMode) {
                return;
            }

            this.setState({
                editMode: true,
                texValue: this.getValue(),
            }, () => {
                this.startEdit();
            });
        };

        this.onValueChange = evt => {
            let value = evt.target.value;
            let invalid = false;
            try {
                katex.__parse(value);
            } catch (err) {
                invalid = true;
            } finally {
                this.setState({
                    invalidTeX: invalid,
                    texValue: value,
                });
            }
        };

        this.save = () => {
            let entityKey = this.props.block.getEntityAt(0);
            let newContentState = this.props.contentState.mergeEntityData(
                entityKey,
                {content: this.state.texValue},
            );
            this.setState({
                invalidTeX: false,
                editMode: false,
                texValue: null,
            }, this.finishEdit.bind(this, newContentState));
        };

        this.remove = () => {
            this.props.blockProps.onRemove(this.props.block.getKey());
        };
        this.startEdit = () => {
            this.props.blockProps.onStartEdit(this.props.block.getKey());
        };
        this.finishEdit = (newContentState) => {
            this.props.blockProps.onFinishEdit(
                this.props.block.getKey(),
                newContentState,
            );
        };
    }

    getValue() {
        return this.props.contentState
            .getEntity(this.props.block.getEntityAt(0))
            .getData()['content'];
    }

    render() {
        let texContent;
        if (this.state.editMode) {
            if (this.state.invalidTeX) {
                texContent = '';
            } else {
                texContent = this.state.texValue;
            }
        } else {
            texContent = this.getValue();
        }

        let className = 'TeXEditor-tex';
        if (this.state.editMode) {
            className += ' TeXEditor-activeTeX';
        }

        let editPanel = null;
        if (this.state.editMode) {
            let buttonClass = 'TeXEditor-saveButton';
            if (this.state.invalidTeX) {
                buttonClass += ' TeXEditor-invalidButton';
            }

            editPanel =
                <div className="TeXEditor-panel">
                    <textarea
                        className="TeXEditor-texValue"
                        onChange={this.onValueChange}
                        ref={this.setDomEditor}
                        value={this.state.texValue}
                    />
                    <div className="TeXEditor-buttons">
                        <button className={buttonClass}
                                disabled={this.state.invalidTeX}
                                onClick={this.save}>
                            {this.state.invalidTeX ? 'InvalidTeX' : 'Done'}
                        </button>
                        <button className="TeXEditor-removeButton" onClick={this.remove}>
                            Remove
                        </button>
                    </div>
                </div>;
        }

        return (
            <div className={className}>
                {editPanel}
                <KatexOutput content={texContent} onClick={this.onClick}/>
            </div>
        );
    }
}

class KatexOutput extends React.PureComponent {
    constructor(props) {
        super(props);
        this.setContainer = ref => this.container = ref;
    }
    update() {
        try {
            katex.render(
                this.props.content,
                this.container,
                {
                    displayMode: true,
                    throwOnError: true
                }
            );
        } catch (err) {
            while (this.container.lastChild) {
                this.container.removeChild(this.container.lastChild);
            }
            let msg = document.createTextNode(err.message);
            let span = document.createElement("span");
            span.appendChild(msg);
            this.container.appendChild(span);
            span.setAttribute("class", "errorMessage");
        }
    }

    componentDidMount() {
        this.update();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (prevProps.content !== this.props.content) {
            this.update();
        }
    }

    render() {
        return <div ref={this.setContainer} onClick={this.props.onClick} />;
    }
}

const rawContent = {
    blocks: [
        {
            text: 'This is a Draft-based editor that supports TeX rendering.',
            type: 'unstyled',
        },
        {
            text: '',
            type: 'unstyled',
        },
        {
            text: (
                'Each TeX block below is represented as a DraftEntity object and ' +
                'rendered using Khan Academy\'s KaTeX library.'
            ),
            type: 'unstyled',
        },
        {
            text: '',
            type: 'unstyled',
        },
        {
            text: 'Click any TeX block to edit.',
            type: 'unstyled',
        },
        {
            text: ' ',
            type: 'atomic',
            entityRanges: [{offset: 0, length: 1, key: 'first'}],
        },
        {
            text: 'You can also insert a new TeX block at the cursor location.',
            type: 'unstyled',
        },
    ],

    entityMap: {
        first: {
            type: 'TOKEN',
            mutability: 'IMMUTABLE',
            data: {
                content: (
                    '\\left( \\sum_{k=1}^n a_k b_k \\right)^{\\!\\!2} \\leq\n' +
                    '\\left( \\sum_{k=1}^n a_k^2 \\right)\n' +
                    '\\left( \\sum_{k=1}^n b_k^2 \\right)'
                ),
            },
        },
    },
};

const content = convertFromRaw(rawContent);


class MediaEditor extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            editorState: EditorState.createEmpty(),
            showURLInput: false,
            url: '',
            urlType: '',

        };
        this.setDomEditor = ref => this.domEditor = ref;
        this.focus = () => this.domEditor.focus();
        this.logState = () => {
            const content = this.state.editorState.getCurrentContent();
            console.log(convertToRaw(content));

        };
        this.onChange = (editorState) => this.setState({editorState});
        this.onURLChange = (e) => this.setState({urlValue: e.target.value});

        this.addAudio = this._addAudio.bind(this);
        this.addImage = this._addImage.bind(this);
        this.addVideo = this._addVideo.bind(this);
        this.confirmMedia = this._confirmMedia.bind(this);
        this.handleKeyCommand = this._handleKeyCommand.bind(this);
        this.onURLInputKeyDown = this._onURLInputKeyDown.bind(this);
    }

    _handleKeyCommand(command, editorState) {
        const newState = RichUtils.handleKeyCommand(editorState, command);
        if (newState) {
            this.onChange(newState);
            return true;
        }
        return false;
    }

    _confirmMedia(e) {
        e.preventDefault();
        const {editorState, urlValue, urlType} = this.state;
        const contentState = editorState.getCurrentContent();
        const contentStateWithEntity = contentState.createEntity(
            urlType,
            'IMMUTABLE',
            {src: urlValue}
        );
        const entityKey = contentStateWithEntity.getLastCreatedEntityKey();
        const newEditorState = EditorState.set(
            editorState,
            {currentContent: contentStateWithEntity}
        );

        this.setState({
            editorState: AtomicBlockUtils.insertAtomicBlock(
                newEditorState,
                entityKey,
                ' '
            ),
            showURLInput: false,
            urlValue: '',
        }, () => {
            setTimeout(() => this.focus(), 0);
        });
    }

    _onURLInputKeyDown(e) {
        if (e.which === 13) {
            this._confirmMedia(e);
        }
    }

    _promptForMedia(type) {
        this.setState({
            showURLInput: true,
            urlValue: '',
            urlType: type,
        }, () => {
            setTimeout(() => this.focus(), 0);
        });
    }

    _addAudio() {
        this._promptForMedia('audio');
    }

    _addImage() {
        this._promptForMedia('image');
    }

    _addVideo() {
        this._promptForMedia('video');
    }

    render() {
        let urlInput;
        if (this.state.showURLInput) {
            urlInput =
                <div style={styles.urlInputContainer}>
                    <input
                        onChange={this.onURLChange}
                        ref={"url"}
                        style={styles.urlInput}
                        type="text"
                        value={this.state.urlValue}
                        onKeyDown={this.onURLInputKeyDown}
                    />
                    <button onMouseDown={this.confirmMedia}>
                        Confirm
                    </button>
                </div>;
        }
        return (
            <div style={styles.root}>
                <div style={{marginBottom: 10}}>
                    Use the buttons to add audio, image, or video.
                </div>
                <div style={{marginBottom: 10}}>
                    Here are some local examples that can be entered as a URL:
                    <ul>
                        <li>https://github.com/facebook/draft-js/blob/main/examples/draft-0-10-0/media/media.mp3</li>
                        <li>https://github.com/facebook/draft-js/blob/main/examples/draft-0-10-0/media/media.png</li>
                        <li>https://github.com/facebook/draft-js/blob/main/examples/draft-0-10-0/media/media.mp4</li>
                    </ul>
                </div>
                <div style={styles.button}>
                    <button onMouseDown={this.addAudio} style={{marginRight: 10}}>
                        Add Audio
                    </button>
                    <button onMouseDown={this.addImage} style={{marginRight: 10}}>
                        Add Image
                    </button>
                    <button onMouseDown={this.addVideo} style={{marginRight: 10}}>
                        Add Video
                    </button>
                </div>
                {urlInput}
                <div style={styles.editor} onClick={this.focus}>
                    <Editor editorState={this.state.editorState} onChange={this.onChange}
                            blockRendererFn={mediaBlockRenderer}
                            handleKeyCommand={this.handleKeyCommand}
                            placeholder={"Enter some text..."}
                            ref={this.setDomEditor}
                    />
                </div>
                <input
                    onClick={this.logState}
                    style={styles.button}
                    type={"button"}
                    value={"Log State"}
                />
            </div>
        );
    }
}

function mediaBlockRenderer(block) {
    if (block.getType() === 'atomic') {
        return {
            component: Media,
            editable: false,
        };
    }
    return null;
}

const Audio = (props) => {
    return <audio controls src={props.src} style={styles.media}/>;
};
const Image = (props) => {
    return <img src={props.src} style={styles.media}/>;
};
const Video = (props) => {
    return <video controls src={props.src} style={styles.media}/>;
};

const Media = (props) => {
    const entity = props.contentState.getEntity(
        props.block.getEntityAt(0)
    );
    const {src} = entity.getData();
    const type = entity.getType();

    let media;
    if (type === 'audio') {
        media = <Audio src={src} />
    } else if (type === 'image') {
        media = <Image src={src} />
    } else if (type === 'video') {
        media = <Video src={src} />
    }
    return media;
}


class ColorfulEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = {editorState: EditorState.createEmpty()};
        this.setDomEditorRef = ref => this.domEditor = ref;
        this.focus = () => this.domEditor.focus();
        this.onChange = (editorState) => this.setState({editorState});
        this.toggleColor = (toggleColor) => this._toggleColor(toggleColor);
    }

    _toggleColor(toggledColor) {
        const {editorState} = this.state;
        const selection = editorState.getSelection();

        const nextContentState = Object.keys(colorStyleMap)
            .reduce((contentState, color) => {
                return Modifier.removeInlineStyle(contentState, selection, color)
            }, editorState.getCurrentContent());

        let nextEditorState = EditorState.push(
            editorState,
            nextContentState,
            'change-inline-style'
        );

        const currentStyle = editorState.getCurrentInlineStyle();

        if (selection.isCollapsed()) {
            nextEditorState = currentStyle.reduce((state, color) => {
                return RichUtils.toggleInlineStyle(state, color);
            }, nextEditorState);
        }
        if (!currentStyle.has(toggledColor)) {
            nextEditorState = RichUtils.toggleInlineStyle(
                nextEditorState,
                toggledColor
            );
        }
        this.onChange(nextEditorState);
    }

    render() {
        const {editorState} = this.state;
        return (
            <div style={styles.root}>
                <ColorControls
                    editorState={editorState}
                    onToggle={this.toggleColor}
                />
                <div style={styles.editor}
                     onClick={this.focus}>
                    <Editor editorState={editorState} onChange={this.onChange}
                            customStyleMap={colorStyleMap}
                            placeholder={"Write something colorful"}
                            ref={this.setDomEditorRef}
                    />
                </div>
            </div>
        );
    }
}

class StyleButton extends React.Component {
    constructor(props) {
        super(props);
        this.onToggle = (e) => {
            e.preventDefault();
            this.props.onToggle(this.props.style);
        };
    }

    render() {
        let style;
        if (this.props.active) {
            style = {...styles.styleButton, ...colorStyleMap[this.props.style]};
        } else {
            style = styles.styleButton;
        }
        return (
            <span style={style} onMouseDown={this.onToggle}>
                {this.props.label}
            </span>
        );
    }
}

const COLORS = [
    {label: 'Red', style: 'red'},
    {label: 'Orange', style: 'orange'},
    {label: 'Yellow', style: 'yellow'},
    {label: 'Green', style: 'green'},
    {label: 'Blue', style: 'blue'},
    {label: 'Indigo', style: 'indigo'},
    {label: 'Violet', style: 'violet'},
];

const ColorControls = (props) => {
    let currentStyle = props.editorState.getCurrentInlineStyle();
    return (
        <div style={styles.controls}>
            {COLORS.map(type =>
                <StyleButton
                    key={type.label}
                    active={currentStyle.has(type.style)}
                    label={type.label}
                    onToggle={props.onToggle}
                    style={type.style}
                />
            )}
        </div>
    );
};

const colorStyleMap = {
    red: {
        color: 'rgba(255, 0, 0, 1.0)',
    },
    orange: {
        color: 'rgba(255, 127, 0, 1.0)',
    },
    yellow: {
        color: 'rgba(180, 180, 0, 1.0)',
    },
    green: {
        color: 'rgba(0, 180, 0, 1.0)',
    },
    blue: {
        color: 'rgba(0, 0, 255, 1.0)',
    },
    indigo: {
        color: 'rgba(75, 0, 130, 1.0)',
    },
    violet: {
        color: 'rgba(127, 0, 255, 1.0)',
    },
};


export {
    MyEditor,
    LinkEditor,
    EntityEditor,
    TweetEditor,
    TeXEditor,
    MediaEditor,
    ColorfulEditor
};
