'use babel';

import React from 'react';


function getNoteLink(noteNode) {
    return `inkdrop://note/${noteNode.id.substring(5)}`;
}


class BookNode {
    constructor(book) {
        this.type = 'book';

        this.id = book._id;
        this.label = book.name;
        this.parent = book.parentBookId;

        this.children = [];

        // this.book = book;
    }
}


class NoteNode {
    constructor(note) {
        this.type = 'note';

        this.id = note._id;
        this.label = note.title;
        this.parent = note.bookId;

        // this.note = note;
    }
}


function applyDepth(tree, depth) {
    tree.forEach(node => {
        if (node.type == 'note') {
            return;
        }

        if (depth <= 1) {
            node.children = [];
        }
        else {
            applyDepth(node.children, depth - 1);
        }
    });
}


async function buildNoteTree() {
    if (!inkdrop.main) {
        return [];
    }

    const db = inkdrop.main.dataStore.getLocalDB();
    const bookNodes = (await db.books.all()).map(book => new BookNode(book));
    const noteNodes = (await db.notes.all({ limit: Number.MAX_VALUE })).docs.map(note => new NoteNode(note));

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

    return rootNodes;
}


function renderBook(bookNode, indexName) {
    const bookNodes = bookNode.children.filter(node => node.type == 'book');
    const noteNodes = bookNode.children.filter(node => node.type == 'note');

    const indexNote = noteNodes.filter(noteNode => noteNode.label == indexName)[0];
    const noteNodesWithoutIndexNote = noteNodes.filter(noteNode => noteNode.label != indexName);

    return (
        <div className="book-node">
            <div>
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
            <a href={link}>{noteNode.label}</a>
        </div>
    );
}


function renderNode(node, indexName) {
    if (node.type == 'book') {
        return renderBook(node);
    }
    else {
        return renderNote(node);
    }
}


export class Ls extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            tree: [],
        };
    }

    getSubTree() {
        const {
            path,
            depth,
        } = this.props;

        const {
            tree,
        } = this.state;

        let subTree = structuredClone(tree);

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

        applyDepth(subTree, depth);

        return subTree;
    }

    async componentDidMount() {
        const tree = await buildNoteTree();

        this.setState({
            tree,
        });
    }

    render() {
        const {
            path,
            index,
        } = this.props;

        if (!path.startsWith('/')) {
            return (
                <span>ls: Currently, only absolute path are allowed.</span>
            );
        }

        const tree = this.getSubTree();
        console.log(index)

        return (
            <div>
                {tree.map((node) => renderNode(node, index))}
            </div>
        )
    }
  }
