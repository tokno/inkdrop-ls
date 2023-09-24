'use babel';

import { markdownRenderer } from 'inkdrop'
import { Ls, cache } from './ls'

module.exports = {
  activate() {
    if (markdownRenderer) {
      markdownRenderer.remarkReactComponents.ls = Ls
    }

    cache.init();
  },

  deactivate() {
    if (markdownRenderer) {
      markdownRenderer.remarkReactComponents.ls = null;
    }

    cache.cleanup();
  }
};
