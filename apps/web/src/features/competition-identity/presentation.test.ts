import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar } from '../../components/Avatar';
import { MarketingHero } from '../../components/MarketingHero';
import { AvatarPicker } from './AvatarPicker';
import { CompetitionIdentityProvider } from './CompetitionIdentityProvider';
import { CompetitionMascot } from './CompetitionMascot';
import type { CompetitionIdentity } from './model';
import { IdentityEditor } from './IdentityEditor';
import { QuizIdentitySettings } from './QuizIdentitySettings';
import { ThemeModePicker } from './ThemeModePicker';
import { PublishThemeDialog } from './PublishThemeDialog';
import { ThemeLibraryPicker } from './ThemeLibraryPicker';
import { invalidateResources, setCacheOwner, setResource } from '../../services/resource-cache';

test('identity picker shows card placeholders until loaded and only then reports an empty library', () => {
  setCacheOwner('picker-loading-test');
  try {
    const loading = renderToStaticMarkup(
      createElement(ThemeLibraryPicker, { selected: null, onSelect: () => {} }),
    );
    assert.match(loading, /aria-busy="true"/);
    assert.match(loading, /جاري تحميل الهويات البصرية/);
    assert.doesNotMatch(loading, /لا توجد هويات/);
    setResource('/api/themes', []);
    const empty = renderToStaticMarkup(
      createElement(ThemeLibraryPicker, { selected: null, onSelect: () => {} }),
    );
    assert.match(empty, /لا توجد هويات بصرية محفوظة بعد/);
    assert.doesNotMatch(empty, /جاري تحميل الهويات البصرية/);
    invalidateResources(['/api/themes']);
    const stale = renderToStaticMarkup(
      createElement(ThemeLibraryPicker, { selected: null, onSelect: () => {} }),
    );
    assert.match(stale, /جاري تحميل الهويات البصرية/);
    assert.doesNotMatch(stale, /لا توجد هويات/);
  } finally {
    setCacheOwner(null);
  }
});

const identity: CompetitionIdentity = {
  name: 'Team',
  character: { kind: 'image', src: '/team/character.png', label: 'Team mascot', motion: 'float' },
  avatars: [{ id: 'team:bird', src: '/team/bird.png', label: 'Bird' }],
};

test('theme selection uses accessible cards and quiz edits offer no global publication control', () => {
  const cards = renderToStaticMarkup(createElement(ThemeModePicker, { value: 'saved', onChange: () => {} }));
  assert.match(cards, /role="group" aria-label="اختيار نوع الهوية"/);
  assert.equal((cards.match(/type="button"/g) ?? []).length, 3);
  assert.match(cards, /aria-pressed="true"/);
  assert.doesNotMatch(cards, /type="radio"/);
  const editor = renderToStaticMarkup(createElement(IdentityEditor, { quizId: 'quiz', defaultName: 'Quiz' }));
  assert.doesNotMatch(editor, /إتاحة الهوية|value="public"/);
  assert.match(editor, /التعديل يخص هذه المسابقة فقط/);
});

test('publishing asks for explicit consent to reuse the identity and provides a private cancel action', () => {
  const html = renderToStaticMarkup(
    createElement(PublishThemeDialog, { open: true, onCancel: () => {}, onConfirm: () => {} }),
  );
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /يستطيع أي شخص استخدام هويتك/);
  assert.match(html, /إبقاء الهوية خاصة/);
  assert.match(html, /نعم، أوافق على إتاحتها للجميع/);
});

test('quiz identity starts quietly inside the builder and the editor asks for images before metadata', () => {
  const settings = renderToStaticMarkup(
    createElement(QuizIdentitySettings, {
      quizId: 'quiz',
      quizTitle: 'Quiz',
      value: null,
      onSaved: () => {},
      onBusyChange: () => {},
    }),
  );
  assert.match(settings, /تخصيص الهوية/);
  assert.doesNotMatch(settings, /role="alert"|لم تضف هوية|\/identities\//);
  const editor = renderToStaticMarkup(
    createElement(IdentityEditor, {
      quizId: 'quiz',
      defaultName: 'Quiz',
      onSaved: () => {},
      onCancel: () => {},
    }),
  );
  assert.match(editor, /type="file" multiple=""/);
  assert.match(editor, /ابدأ برفع صور جهتك/);
  assert.doesNotMatch(editor, /role="alert"|حركة الشخصية المرفوعة|اسم الجهة/);
  assert.match(editor, /disabled="" type="submit"/);
});

test('identity scope supplies the picker, player artwork and mascot without leaking to other renders', () => {
  const html = renderToStaticMarkup(
    createElement(CompetitionIdentityProvider, {
      identity,
      children: createElement(
        'section',
        null,
        createElement(AvatarPicker, { value: 'team:bird', onChange: () => {} }),
        createElement(CompetitionMascot, {}),
      ),
    }),
  );
  assert.match(html, /src="\/team\/bird.png"/);
  assert.match(html, /aria-label="Bird" aria-pressed="true"/);
  assert.match(html, /src="\/team\/character.png"/);
  assert.match(html, /competition-character__image--float/);
  assert.doesNotMatch(html, /bolt-base-v2/);

  const defaultHtml = renderToStaticMarkup(createElement(Avatar, { src: 'bolt-avatar-01' }));
  assert.match(defaultHtml, /bolt-base-v2/);
  assert.doesNotMatch(defaultHtml, /\/team\//);
});

test('global marketing keeps Bolt even when rendered inside a custom competition scope', () => {
  const html = renderToStaticMarkup(
    createElement(CompetitionIdentityProvider, {
      identity,
      children: createElement(MarketingHero, { context: 'login' }),
    }),
  );
  assert.match(html, /src="\/bolt-original.png"/);
  assert.doesNotMatch(html, /\/team\//);
});

test('a still custom character opts out of animation and the flight stage', () => {
  const html = renderToStaticMarkup(
    createElement(CompetitionIdentityProvider, {
      identity: {
        ...identity,
        character: { kind: 'image', src: '/team/still.png', label: 'Logo', motion: 'still' },
      },
      children: createElement(CompetitionMascot, { presentation: 'roaming' }),
    }),
  );
  assert.match(html, /src="\/team\/still.png"/);
  assert.doesNotMatch(html, /image--float|mascot-flight-area/);
});

test('only custom flying characters use compact motion; Bolt retains full roaming', () => {
  const render = (character: CompetitionIdentity['character']) =>
    renderToStaticMarkup(
      createElement(CompetitionIdentityProvider, {
        identity: { ...identity, character },
        children: createElement(CompetitionMascot, { presentation: 'roaming' }),
      }),
    );
  assert.match(render(identity.character), /data-flight-mode="compact"/);
  assert.match(render({ kind: 'bolt' }), /data-flight-mode="roaming"/);
});

test('custom avatars keep a bounded tile or hero stage independent of image proportions', () => {
  const render = (presentation: 'tile' | 'hero') =>
    renderToStaticMarkup(
      createElement(CompetitionIdentityProvider, {
        identity,
        children: createElement(Avatar, {
          src: 'team:bird',
          presentation,
          className: 'w-full',
          label: 'Bird',
        }),
      }),
    );
  assert.match(render('tile'), /class="avatar w-full" role="img" aria-label="Bird"/);
  assert.match(render('hero'), /class="avatar avatar--hero w-full"/);
  assert.match(render('tile'), /class="h-full w-full object-contain"/);
});
