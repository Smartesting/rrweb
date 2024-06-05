/**
 * @jest-environment jsdom
 */
import { JSDOM } from 'jsdom';
import {
  absoluteToStylesheet,
  serializeNodeWithId,
  _isBlockedElement,
  needMaskingText,
} from '../src/snapshot';
import { serializedNodeWithId, elementNode } from '../src/types';
import { Mirror } from '../src/utils';

describe('absolute url to stylesheet', () => {
  const href = 'http://localhost/css/style.css';

  it('can handle relative path', () => {
    expect(absoluteToStylesheet('url(a.jpg)', href)).toEqual(
      `url(http://localhost/css/a.jpg)`,
    );
  });

  it('can handle same level path', () => {
    expect(absoluteToStylesheet('url("./a.jpg")', href)).toEqual(
      `url("http://localhost/css/a.jpg")`,
    );
  });

  it('can handle parent level path', () => {
    expect(absoluteToStylesheet('url("../a.jpg")', href)).toEqual(
      `url("http://localhost/a.jpg")`,
    );
  });

  it('can handle absolute path', () => {
    expect(absoluteToStylesheet('url("/a.jpg")', href)).toEqual(
      `url("http://localhost/a.jpg")`,
    );
  });

  it('can handle external path', () => {
    expect(absoluteToStylesheet('url("http://localhost/a.jpg")', href)).toEqual(
      `url("http://localhost/a.jpg")`,
    );
  });

  it('can handle single quote path', () => {
    expect(absoluteToStylesheet(`url('./a.jpg')`, href)).toEqual(
      `url('http://localhost/css/a.jpg')`,
    );
  });

  it('can handle no quote path', () => {
    expect(absoluteToStylesheet('url(./a.jpg)', href)).toEqual(
      `url(http://localhost/css/a.jpg)`,
    );
  });

  it('can handle multiple no quote paths', () => {
    expect(
      absoluteToStylesheet(
        'background-image: url(images/b.jpg);background: #aabbcc url(images/a.jpg) 50% 50% repeat;',
        href,
      ),
    ).toEqual(
      `background-image: url(http://localhost/css/images/b.jpg);` +
        `background: #aabbcc url(http://localhost/css/images/a.jpg) 50% 50% repeat;`,
    );
  });

  it('can handle data url image', () => {
    expect(
      absoluteToStylesheet('url(data:image/gif;base64,ABC)', href),
    ).toEqual('url(data:image/gif;base64,ABC)');
    expect(
      absoluteToStylesheet(
        'url(data:application/font-woff;base64,d09GMgABAAAAAAm)',
        href,
      ),
    ).toEqual('url(data:application/font-woff;base64,d09GMgABAAAAAAm)');
  });

  it('preserves quotes around inline svgs with spaces', () => {
    expect(
      absoluteToStylesheet(
        "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Cpath fill='%2328a745' d='M3'/%3E%3C/svg%3E\")",
        href,
      ),
    ).toEqual(
      "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Cpath fill='%2328a745' d='M3'/%3E%3C/svg%3E\")",
    );
    expect(
      absoluteToStylesheet(
        'url(\'data:image/svg+xml;utf8,<svg width="28" height="32" viewBox="0 0 28 32" xmlns="http://www.w3.org/2000/svg"><path d="M27 14C28" fill="white"/></svg>\')',
        href,
      ),
    ).toEqual(
      'url(\'data:image/svg+xml;utf8,<svg width="28" height="32" viewBox="0 0 28 32" xmlns="http://www.w3.org/2000/svg"><path d="M27 14C28" fill="white"/></svg>\')',
    );
    expect(
      absoluteToStylesheet(
        'url("data:image/svg+xml;utf8,<svg width="28" height="32" viewBox="0 0 28 32" xmlns="http://www.w3.org/2000/svg"><path d="M27 14C28" fill="white"/></svg>")',
        href,
      ),
    ).toEqual(
      'url("data:image/svg+xml;utf8,<svg width="28" height="32" viewBox="0 0 28 32" xmlns="http://www.w3.org/2000/svg"><path d="M27 14C28" fill="white"/></svg>")',
    );
  });
  it('can handle empty path', () => {
    expect(absoluteToStylesheet(`url('')`, href)).toEqual(`url('')`);
  });
});

describe('isBlockedElement()', () => {
  const subject = (
    html: string,
    opt: Partial<{ blockSelector: string; allowList: string | null }> = {},
  ) =>
    _isBlockedElement(
      render(html),
      'rr-block',
      opt.blockSelector ?? null,
      opt.allowList ?? null,
    );

  const render = (html: string): HTMLElement =>
    JSDOM.fragment(html).querySelector('div')!;

  it('can handle empty elements', () => {
    expect(subject('<div />')).toEqual(false);
  });

  it('blocks prohibited className', () => {
    expect(subject('<div class="foo rr-block bar" />')).toEqual(true);
  });

  it('does not block random data selector', () => {
    expect(subject('<div data-rr-block />')).toEqual(false);
  });

  it('blocks blocked selector', () => {
    expect(
      subject('<div data-rr-block />', { blockSelector: '[data-rr-block]' }),
    ).toEqual(true);
  });

  it('does not block blocked selector inside the allow list', () => {
    expect(
      subject('<div class="allow"></div><div data-rr-block /></div>', {
        blockSelector: '[data-rr-block]',
        allowList: '.allow',
      }),
    ).toEqual(false);
  });
});

describe('style elements', () => {
  const serializeNode = (node: Node): serializedNodeWithId | null => {
    return serializeNodeWithId(node, {
      doc: document,
      mirror: new Mirror(),
      blockClass: 'blockblock',
      blockSelector: null,
      maskTextClass: 'maskmask',
      maskTextSelector: null,
      skipChild: false,
      inlineStylesheet: true,
      maskTextFn: undefined,
      maskInputFn: undefined,
      slimDOMOptions: {},
      allowList: null,
      blockExtraStyle: null,
    });
  };

  const render = (html: string): HTMLStyleElement => {
    document.write(html);
    return document.querySelector('style')!;
  };

  it('should serialize all rules of stylesheet when the sheet has a single child node', () => {
    const styleEl = render(`<style>body { color: red; }</style>`);
    styleEl.sheet?.insertRule('section { color: blue; }');
    expect(serializeNode(styleEl.childNodes[0])).toMatchObject({
      isStyle: true,
      rootId: undefined,
      textContent: 'section {color: blue;}body {color: red;}',
      type: 3,
    });
  });

  it('should serialize individual text nodes on stylesheets with multiple child nodes', () => {
    const styleEl = render(`<style>body { color: red; }</style>`);
    styleEl.append(document.createTextNode('section { color: blue; }'));
    expect(serializeNode(styleEl.childNodes[1])).toMatchObject({
      isStyle: true,
      rootId: undefined,
      textContent: 'section { color: blue; }',
      type: 3,
    });
  });
});

describe('scrollTop/scrollLeft', () => {
  const serializeNode = (node: Node): serializedNodeWithId | null => {
    return serializeNodeWithId(node, {
      doc: document,
      mirror: new Mirror(),
      blockClass: 'blockblock',
      blockSelector: null,
      maskTextClass: 'maskmask',
      maskTextSelector: null,
      skipChild: false,
      inlineStylesheet: true,
      maskTextFn: undefined,
      maskInputFn: undefined,
      slimDOMOptions: {},
      newlyAddedElement: false,
      allowList: null,
      blockExtraStyle: null,
    });
  };

  const render = (html: string): HTMLDivElement => {
    document.write(html);
    return document.querySelector('div')!;
  };

  it('should serialize scroll positions', () => {
    const el = render(`<div stylel='overflow: auto; width: 1px; height: 1px;'>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
    </div>`);
    el.scrollTop = 10;
    el.scrollLeft = 20;
    expect(serializeNode(el)).toMatchObject({
      attributes: {
        rr_scrollTop: 10,
        rr_scrollLeft: 20,
      },
    });
  });
});

describe('form', () => {
  const serializeNode = (node: Node): serializedNodeWithId | null => {
    return serializeNodeWithId(node, {
      doc: document,
      mirror: new Mirror(),
      blockClass: 'blockblock',
      blockSelector: null,
      maskTextClass: 'maskmask',
      maskTextSelector: null,
      skipChild: false,
      inlineStylesheet: true,
      maskTextFn: undefined,
      maskInputFn: undefined,
      slimDOMOptions: {},
      newlyAddedElement: false,
      allowList: null,
      blockExtraStyle: null,
    });
  };

  const render = (html: string): HTMLTextAreaElement => {
    document.write(html);
    return document.querySelector('textarea')!;
  };

  it('should record textarea values once', () => {
    const el = render(`<textarea>Lorem ipsum</textarea>`);
    const sel = serializeNode(el) as elementNode;

    // we serialize according to where the DOM stores the value, not how
    // the HTML stores it (this is so that maskInputValue can work over
    // inputs/textareas/selects in a uniform way)
    expect(sel).toMatchObject({
      attributes: {
        value: 'Lorem ipsum',
      },
    });
    expect(sel?.childNodes).toEqual([]); // shouldn't be stored in childNodes while in transit
  });
});

describe('needMaskingText', () => {
  const documentHtml = `
  <div class="main">
    <div class="masked">
      Some masked content
      <p>Some more masked content</p>
    </div>
    <div class="unmasked">
      Some unmasked content
      <p>Some more unmasked content</p>
    </div>  
  </div>
  `;

  const maskTextClass = 'rrblock';
  const maskTextSelector: string | null = null;
  const allowList: string | null = null;

  const render = (html: string, selector: string): HTMLTextAreaElement => {
    document.write(html);
    return document.querySelector(selector)!;
  };

  function testNeedMaskingText(
    title: string,
    elementSelector: string,
    maskTextClass: string | RegExp,
    maskTextSelector: string | null,
    allowList: string | null,
    checkAncestors: boolean,
    expected: boolean,
  ) {
    it(title, () => {
      const element = render(documentHtml, elementSelector);

      expect(
        needMaskingText(
          element,
          maskTextClass,
          maskTextSelector,
          allowList,
          checkAncestors,
        ),
      ).toEqual(expected);
    });
  }

  describe('when using maskTextClass', () => {
    testNeedMaskingText(
      'returns true if the element has a class matching the regexp',
      'div.masked',
      /mask/,
      null,
      null,
      false,
      true,
    );

    testNeedMaskingText(
      'returns true if the element has the CSS class',
      'div.masked',
      'masked',
      null,
      null,
      false,
      true,
    );

    testNeedMaskingText(
      'returns true if the element is an child of a matching element and checkAncestors is true',
      'div.masked p',
      /masked/,
      null,
      null,
      true,
      true,
    );

    testNeedMaskingText(
      'returns true if the element is an child of a matching element and checkAncestors is true',
      'div.masked p',
      'masked',
      null,
      null,
      true,
      true,
    );

    testNeedMaskingText(
      'returns false if the element does not have a class matching the regexp',
      'div.masked',
      /whatever/,
      null,
      null,
      false,
      false,
    );

    testNeedMaskingText(
      'returns false if the element does not have the CSS class',
      'div.masked',
      'whatever',
      null,
      null,
      false,
      false,
    );

    testNeedMaskingText(
      'returns false if the element is an child of a matching element and checkAncestors is false',
      'div.masked p',
      '.masked',
      null,
      null,
      false,
      false,
    );

    testNeedMaskingText(
      'returns false if the element is an child of a matching element and checkAncestors is false',
      'div.masked p',
      /masked/,
      null,
      null,
      false,
      false,
    );
  });

  describe('when using maskTextSelector', () => {
    testNeedMaskingText(
      'returns true if the element matches the selector',
      'div.masked',
      'rr-block',
      '.masked',
      null,
      false,
      true,
    );

    testNeedMaskingText(
      'returns true if the element is an child of a matching element and checkAncestors is true',
      'div.masked p',
      'rr-block',
      '.masked',
      null,
      true,
      true,
    );

    testNeedMaskingText(
      'returns false if the element does not match the selector',
      'div.unmasked',
      'rr-block',
      '.masked',
      null,
      false,
      false,
    );

    testNeedMaskingText(
      'returns false if the element is an child of a matching element and checkAncestors is false',
      'div.masked p',
      'rr-block',
      '.masked',
      null,
      false,
      false,
    );
  });

  describe('when allowList is specified', () => {
    testNeedMaskingText(
      'returns false even if the element matches matchTextClass',
      'div.masked',
      /masked/,
      null,
      '.main',
      false,
      false,
    );
  });
});
