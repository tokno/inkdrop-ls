'use babel';

import React from 'react';


function cloneTree(tree) {
    return tree.map((node) => {
        if (node.type == 'note') {
            return node;
        }
        
        const newNode = new BookNode(node.book);

        if (node.children.length) {
            newNode.children = cloneTree(node.children);
        }

        return newNode;
    });
}


class BookNode {
    constructor(book) {
        this.type = 'book';

        this.id = book._id;
        this.label = book.name;
        this.parent = book.parentBookId;

        this.children = [];

        this.book = book;
    }
}


class NoteNode {
    constructor(note) {
        this.type = 'note';

        this.id = note._id;
        this.label = note.title;
        this.parent = note.bookId;

        this.note = note;
    }
}


class DatabaseCache {
    #disposables = [];

    constructor() {
        this.tree = [];
        this.tags = [];
        this.listeners = [];
    }

    replaceTree(tree) {
        this.tree = tree;
        this.listeners.forEach(l => l(this));
    }

    addListener(listener) {
        this.listeners.push(listener);
    }

    removeListener(listener) {
        this.listeners = this.listeners.filter(l => listener != l);
    }

    findTagByName(tagName) {
        return this.tags.find((tag) => tag.name == tagName);
    }

    getSubTree(path, depth, tag) {
        const applyDepth = (tree, depth) => {
            const newTree = [];

            if (!tree.length) {
                return newTree;
            }

            tree.forEach(node => {
                if (node.type == 'note') {
                    newTree.push(node);
                    return;
                }

                const copy = new BookNode(node.book);

                if (1 < depth) {
                    copy.children = applyDepth(node.children, depth - 1);
                }

                newTree.push(copy);
            });

            return newTree;
        }

        const applyTagFilter = (tree, tag) => {
            if (tag === undefined) {
                return tree;
            }

            const newTree = [];
            const tagId = this.findTagByName(tag)?._id;

            tree.forEach((node) => {
                if (node.type == 'book') {
                    const book = new BookNode(node.book);
                    book.children = applyTagFilter(node.children, tag);
                    newTree.push(book);
                    return;
                }
                if (tag === '' && !node.note.tags.length) {
                    newTree.push(node);
                    return;
                }

                if (node.note.tags.includes(tagId)) {
                    newTree.push(node);
                    return;
                }
            });

            return newTree;
        }
        
        let subTree = cloneTree(this.tree);

        if (path.startsWith('/')) {
            const p = path.split('/').slice(1);
    
            if (!p[p.length - 1]) {
                p.pop();
            }

            while (p.length) {
                const label = p.shift();
                const tmp = subTree.filter(node => node.label == label);
    
                subTree = tmp[0]?.children || [];
            }
        }
        else {
            throw 'Currently, only absolute path are allowed.';
        }

        subTree = applyDepth(subTree, depth);
        subTree = applyTagFilter(subTree, tag);

        return subTree;
    }

    async rebuildTags() {
        if (!inkdrop.main) {
            return [];
        }
    
        const db = inkdrop.main.dataStore.getLocalDB();
        this.tags = await db.tags.all();
    }

    async rebuildTree() {
        if (!inkdrop.main) {
            return [];
        }
    
        const compare = (a, b) => {
            if (a < b) return -1;
            else if (a > b) return 1;
            else return 0;
        }
    
        const compareByKey = (key) => (a, b) => compare(a[key], b[key]);
    
        const db = inkdrop.main.dataStore.getLocalDB();
        const bookNodes = (await db.books.all())
            .map(book => new BookNode(book));
    
        const noteNodes = (await db.notes.all({ limit: Number.MAX_VALUE })).docs
            .map(note => new NoteNode(note));
    
        bookNodes.sort(compareByKey('label'));
        noteNodes.sort(compareByKey('label'));
    
        const nodes = [...bookNodes, ...noteNodes].reduce((acc, node) => {
            acc[node.id] = node;
            return acc;
        }, {});
    
        Object.values(nodes).forEach(node => {
            if (node.parent) {
                nodes[node.parent].children.push(node);
            }
        });
    
        const rootNodes = Object.values(nodes).filter(node => !node.parent);
    
        this.replaceTree(rootNodes);
    }

    _listenDbChanges() {
        const db = inkdrop.main.dataStore.getLocalDB();

        this.#disposables.push(
            db.onBookChange((change) => {
                this.rebuildTree();
            })
        );

        this.#disposables.push(
            db.onNoteChange((change) => {
                this.rebuildTree();
            })
        );

        this.#disposables.push(
            db.onTagChange((change) => {
                this.rebuildTags();
            })
        );
    }
    
    async init() {
        this._listenDbChanges();

        await Promise.all([
            this.rebuildTags(),
            this.rebuildTree(),
        ])
    }

    cleanup() {
        this.tree = [];
        this.listeners = [];

        this.#disposables.forEach((d) => d.dispose());
    }
}


export const cache = new DatabaseCache();


function getNoteLink(noteNode) {
    return `inkdrop://note/${noteNode.id.substring(5)}`;
}


function renderBook(bookNode, indexName) {
    const bookNodes = bookNode.children.filter(node => node.type == 'book');
    const noteNodes = bookNode.children.filter(node => node.type == 'note');

    const indexNote = noteNodes.find(noteNode => noteNode.label == indexName);
    const noteNodesWithoutIndexNote = noteNodes.filter(noteNode => noteNode.label != indexName);

    return (
        <div className="book-node">
            <div>
                <span className="icon-space">
                    <svg xmlns="http://www.w3.org/2000/svg" width="1.2rem" height="1.2rem" viewBox="0 0 448 512"><path d="M96 0C43 0 0 43 0 96V416c0 53 43 96 96 96H384h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V384c17.7 0 32-14.3 32-32V32c0-17.7-14.3-32-32-32H384 96zm0 384H352v64H96c-17.7 0-32-14.3-32-32s14.3-32 32-32zm32-240c0-8.8 7.2-16 16-16H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16zm16 48H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16s7.2-16 16-16z"/></svg>
                </span>
                {indexNote
                    ? <a href={getNoteLink(indexNote)}>{bookNode.label}</a>
                    : bookNode.label
                }
            </div>
            <div style={{'padding-left': '2rem'}}>
                {bookNodes.map((node) => renderNode(node, indexName))}
                {noteNodesWithoutIndexNote.map((node) => renderNode(node, indexName))}
            </div>
        </div>
    )
}


function renderNote(noteNode) {
    const link = getNoteLink(noteNode);

    return (
        <div className="note-node">
            <span className="icon-space"></span>
            <a href={link}>{noteNode.label}</a>
        </div>
    );
}


function renderNode(node, indexName) {
    if (node.type == 'book') {
        return renderBook(node, indexName);
    }
    else {
        return renderNote(node);
    }
}


export class Ls extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            renderCount: 0,
        }

        this.onTreeChange = () => {
            this.setState((state) => ({
                treeAge: state.treeAge + 1,
            }));    
        }
    }

    async componentDidMount() {
        cache.addListener(this.onTreeChange);
    }

    componentWillUnmount() {
        cache.removeListener(this.onTreeChange);
    }

    render() {
        let {
            depth,
            index,
            path,
            tag,
        } = this.props;

        path = path || '/';

        if (!path.startsWith('/')) {
            return (
                <span>ls: Currently, only absolute path are allowed.</span>
            );
        }

        const tree = cache.getSubTree(path, depth, tag);
        const treeWithoutIndexNote = tree.filter((node) => !(node.type == 'note' && node.label == index));

        return (
            <div className="inkdrop-ls">
                {treeWithoutIndexNote.map((node) => renderNode(node, index))}
            </div>
        )
    }
  }
