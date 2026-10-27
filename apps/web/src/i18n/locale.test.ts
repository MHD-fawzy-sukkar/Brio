import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { catalog } from './messages';
import {
  getLocale,
  initializeLocale,
  LANGUAGE_KEY,
  setLocale,
  subscribeLocale,
  t,
  translateMessage,
} from './locale';
import { IdentityEditor } from '../features/competition-identity/IdentityEditor';
import { MarketingHero } from '../components/MarketingHero';
import { typeLabels } from '../features/question-editor/model';
import { DEFAULT_COMPETITION_IDENTITY } from '../features/competition-identity/model';

test('catalogs cover every source key and preserve interpolation slots', () => {
  const slots = (text: string) => [...text.matchAll(/\{(\d+)\}/g)].map((m) => m[1]).sort();
  for (const [ar, en] of Object.entries(catalog)) {
    assert.ok(en.trim(), ar);
    assert.deepEqual(slots(en), slots(ar), ar);
    if (ar !== '٠١٢٣٤٥٦٧٨٩') assert.doesNotMatch(en, /[\u0600-\u06ff]/, ar);
  }
  function scan(directory: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'i18n') scan(file);
        continue;
      }
      if (!/\.tsx?$/.test(file) || file.includes('.test.')) continue;
      const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node) {
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(ast) === 't' &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        )
          assert.ok(catalog[node.arguments[0].text], file + ': ' + node.arguments[0].text);
        if (ts.isJsxText(node)) assert.doesNotMatch(node.text, /[\u0600-\u06ff]/, file);
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  }
  scan(path.resolve('src'));
});

test('language switches update labels and stored messages while preserving user-authored content', () => {
  try {
    setLocale('en');
    assert.equal(t('غلاف {0}', { 0: 'مسابقتي' }), 'Cover for مسابقتي');
    assert.equal(translateMessage('جاري تجهيز الصور 2 / 5…'), 'Preparing images 2 / 5…');
    assert.equal(translateMessage('تعذّر حفظ الهوية.'), 'Unable to save the identity.');
    assert.equal(
      translateMessage('Failed to fetch'),
      'Unable to connect to the service. Refresh the page and try again.',
    );
    assert.equal(typeLabels.Poll, 'Poll');
    assert.equal(DEFAULT_COMPETITION_IDENTITY.avatars[0].label, 'Image 1');
    const editor = renderToStaticMarkup(
      createElement(IdentityEditor, { defaultName: 'فريق الأثر', libraryId: '' }),
    );
    assert.match(editor, /value="فريق الأثر"/);
    // Server markup must remain Arabic even when browser preference is already English.
    assert.match(editor, /حفظ الهوية/);
    assert.doesNotMatch(editor, /Save identity/);
    const hero = renderToStaticMarkup(createElement(MarketingHero, { context: 'join' }));
    assert.match(hero, /دخول فوري/);
    assert.doesNotMatch(hero, /Instant join/);
    setLocale('ar');
    assert.equal(translateMessage('Preparing images 2 / 5…'), 'جاري تجهيز الصور 2 / 5…');
    assert.equal(translateMessage('Unable to save the identity.'), 'تعذّر حفظ الهوية.');
    assert.equal(typeLabels.Poll, 'استطلاع رأي');
    assert.equal(
      translateMessage('Failed to fetch'),
      'تعذّر الاتصال بخدمة الموقع. حدّث الصفحة وحاول مجدداً.',
    );
  } finally {
    setLocale('ar');
  }
});

test('preference restores direction and remains usable when storage is blocked', () => {
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const saved = new Map<string, string>([[LANGUAGE_KEY, 'en']]);
  const html = { lang: 'ar', dir: 'rtl' };
  let notices = 0;
  const stop = subscribeLocale(() => notices++);
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => saved.get(key),
        setItem: (key: string, value: string) => saved.set(key, value),
      },
    });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: html } });
    initializeLocale();
    assert.equal(getLocale(), 'en');
    assert.equal(html.dir, 'ltr');
    setLocale('ar');
    assert.equal(saved.get(LANGUAGE_KEY), 'ar');
    assert.equal(html.dir, 'rtl');
    assert.equal(notices, 2);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw Error('blocked');
      },
    });
    assert.doesNotThrow(() => setLocale('en'));
    assert.doesNotThrow(initializeLocale);
  } finally {
    stop();
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
    else Reflect.deleteProperty(globalThis, 'document');
    setLocale('ar');
  }
});
