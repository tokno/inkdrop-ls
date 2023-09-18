'use babel';

import { markdownRenderer } from 'inkdrop'
import { ls, Ls } from './ls'

module.exports = {
  activate() {
    if (markdownRenderer) {
      markdownRenderer.remarkReactComponents.ls = Ls
    }
  },

  deactivate() {
    if (markdownRenderer) {
      markdownRenderer.remarkReactComponents.ls = null;
    }
  }
};
