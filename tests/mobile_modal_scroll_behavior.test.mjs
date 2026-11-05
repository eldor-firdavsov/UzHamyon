import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Mobile Swipe & Scroll Behavior in UzHamyon Transaction Forms', () => {
  const rootDir = process.cwd();

  test('1. useModalScrollLock implementation properly captures and restores body scroll', () => {
    const fileContent = fs.readFileSync(
      path.join(rootDir, 'src/lib/ui/useModalScrollLock.ts'),
      'utf8'
    );

    // Verify critical lock mechanics for iOS WKWebView and Android
    assert.ok(fileContent.includes("document.body.style.position = 'fixed'"), 'Must set position fixed on body');
    assert.ok(fileContent.includes("document.body.style.top = `-${savedScrollY}px`"), 'Must set negative top offset matching scrollY');
    assert.ok(fileContent.includes("document.body.style.overflow = 'hidden'"), 'Must set overflow hidden on body');
    assert.ok(fileContent.includes("window.scrollTo"), 'Must restore scroll position on unlock');
    assert.ok(fileContent.includes("lockCount"), 'Must handle multiple concurrent modals via ref counter');
  });

  test('2. TransactionModal has overscroll containment, touch-pan-y, and pinned header/footer', () => {
    const fileContent = fs.readFileSync(
      path.join(rootDir, 'src/components/transactions/TransactionModal.tsx'),
      'utf8'
    );

    // Verify scroll lock integration
    assert.ok(fileContent.includes('useModalScrollLock(props.isOpen)'), 'Must call useModalScrollLock');

    // Verify backdrop touch containment
    assert.ok(fileContent.includes('overscroll-contain'), 'Backdrop must contain overscroll');
    assert.ok(fileContent.includes('touch-pan-y'), 'Backdrop must constrain gestures to pan-y');

    // Verify modal container bounds (dynamic viewport height dvh)
    assert.ok(fileContent.includes('max-h-[90dvh]'), 'Modal must respect dynamic mobile viewport height');
    assert.ok(fileContent.includes('overflow-hidden'), 'Outer modal container must prevent outer scroll leaks');

    // Verify pinned header and action buttons
    assert.ok(fileContent.includes('shrink-0'), 'Header and footer must have shrink-0 to remain visible');
    assert.ok(fileContent.includes('overflow-y-auto'), 'Form body must be independently scrollable');
  });

  test('3. FastTransactionModal has overscroll containment, touch-pan-y, and pinned header/footer', () => {
    const fileContent = fs.readFileSync(
      path.join(rootDir, 'src/components/transactions/FastTransactionModal.tsx'),
      'utf8'
    );

    // Verify scroll lock integration
    assert.ok(fileContent.includes('useModalScrollLock(isOpen)'), 'Must call useModalScrollLock');

    // Verify touch constraints
    assert.ok(fileContent.includes('overscroll-contain'), 'Backdrop must contain overscroll');
    assert.ok(fileContent.includes('touch-pan-y'), 'Must constrain touch gestures to pan-y');
    assert.ok(fileContent.includes('max-h-[90dvh]'), 'Modal must respect dynamic mobile viewport height dvh');

    // Verify internal scroll architecture
    assert.ok(fileContent.includes('shrink-0'), 'Header and buttons must be pinned with shrink-0');
    assert.ok(fileContent.includes('overflow-y-auto'), 'Form body must scroll independently');
  });

  test('4. AddTransactionModal (Prototype) has scroll lock and overscroll containment', () => {
    const fileContent = fs.readFileSync(
      path.join(rootDir, 'src/prototype/components/AddTransactionModal.tsx'),
      'utf8'
    );

    assert.ok(fileContent.includes('useModalScrollLock(isOpen)'), 'Must call useModalScrollLock');
    assert.ok(fileContent.includes('overscroll-contain'), 'Must contain overscroll');
    assert.ok(fileContent.includes('touch-pan-y'), 'Must constrain touch to pan-y');
    assert.ok(fileContent.includes('max-h-[90dvh]'), 'Must use dvh units for mobile keyboards');
    assert.ok(fileContent.includes('shrink-0'), 'Header and buttons must be pinned with shrink-0');
  });

  test('5. Prototype CSS (.ov, .sh, .sh.fx, .fxb) enforces overscroll containment & touch-pan-y', () => {
    const cssContent = fs.readFileSync(
      path.join(rootDir, 'src/app/prototype/prototype.css'),
      'utf8'
    );

    assert.ok(cssContent.includes('.ov'), 'Must define .ov');
    assert.ok(cssContent.includes('overscroll-behavior: contain'), 'Must set overscroll-behavior: contain in modals');
    assert.ok(cssContent.includes('touch-action: pan-y'), 'Must set touch-action: pan-y in modals');
    assert.ok(cssContent.includes('92dvh') || cssContent.includes('94dvh'), 'Must use dvh units for dynamic viewport height');
  });

  test('6. Form inputs and pickers do not have broad preventDefault touch handlers', () => {
    const txModal = fs.readFileSync(path.join(rootDir, 'src/components/transactions/TransactionModal.tsx'), 'utf8');
    const fastModal = fs.readFileSync(path.join(rootDir, 'src/components/transactions/FastTransactionModal.tsx'), 'utf8');

    // Check that onTouchStart or onTouchMove do not call preventDefault on inputs
    assert.ok(!txModal.includes('onTouchMove={(e) => e.preventDefault()}'), 'Must not block touchmove on form');
    assert.ok(!fastModal.includes('onTouchMove={(e) => e.preventDefault()}'), 'Must not block touchmove on form');
    assert.ok(!txModal.includes('onTouchStart={(e) => e.preventDefault()}'), 'Must not block touchstart on form');
  });

  test('7. No global touch-action: none is defined in global styles', () => {
    const globalsCss = fs.readFileSync(path.join(rootDir, 'src/app/globals.css'), 'utf8');
    assert.ok(!globalsCss.includes('touch-action: none'), 'globals.css must never declare global touch-action: none');
  });
});
