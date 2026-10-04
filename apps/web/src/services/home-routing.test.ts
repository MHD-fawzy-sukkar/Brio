import test from 'node:test';
import assert from 'node:assert/strict';
import { JOIN_GAME_HREF, normalizePin, resolveHomeExperience, resolveLogoHref } from './home-routing';

test('home waits for auth before choosing an experience', () => {
  assert.equal(resolveHomeExperience(true, false), 'loading');
  assert.equal(resolveHomeExperience(true, true), 'loading');
});

test('home sends creators to dashboard and guests to join', () => {
  assert.equal(resolveHomeExperience(false, true), 'dashboard');
  assert.equal(resolveHomeExperience(false, false), 'join');
});

test('join navigation bypasses the creator home redirect and logo uses exported routes', () => {
  assert.equal(JOIN_GAME_HREF, '/join-game/');
  assert.notEqual(JOIN_GAME_HREF, resolveLogoHref(true));
  assert.equal(resolveLogoHref(true), '/dashboard/');
  assert.equal(resolveLogoHref(false), '/');
});

test('PIN normalization accepts Arabic digits and strips other characters', () => {
  assert.equal(normalizePin('١٢٣-٤٥٦'), '123456');
  assert.equal(normalizePin('12a345678'), '123456');
});
