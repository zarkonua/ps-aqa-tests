import { test, expect } from '../fixtures/e2e.fixture';

/**
 * Notes management (create/edit/delete/render/escape).
 * @smoke — UI-NOTE-01: the core notes journey through the browser. Creating a note via the
 *   form renders a new card in the list and updates the counter without a manual reload (SPA re-render).
 * @regression — UI-NOTE-02…08, 10.
 */
test.describe('UI — Notes management', () => {
  test(
    'UI-NOTE-01: create a note through the form (appears in list, total increments)',
    { tag: '@smoke' },
    async ({ signedInPage, notesPage }) => {
      void signedInPage; // fixture side-effect: page is authenticated as a fresh user

      await expect(notesPage.view).toBeVisible();

      const title = `UI note ${Date.now()}`;
      const content = 'Created through the UI create form.';
      await notesPage.createNote(title, content);

      const card = notesPage.noteCard(title);
      await expect(card).toBeVisible();
      await expect(card).toContainText(content);
      // A fresh seeded user starts with zero notes, so the total is now 1.
      await expect(notesPage.totalLabel).toContainText('1');
    },
  );

  test(
    'UI-NOTE-02: editing a note reflects in the list and persists',
    { tag: '@regression' },
    async ({ signedInPage, notesPage }) => {
      void signedInPage;
      const title = `edit ${Date.now()}`;
      await notesPage.createNote(title, 'original content');
      await expect(notesPage.noteCard(title)).toBeVisible();

      const newTitle = `${title} EDITED`;
      await notesPage.editNote(title, newTitle, 'updated content');
      await expect(notesPage.noteCard(newTitle)).toContainText('updated content');

      await signedInPage.reload();
      await expect(notesPage.noteCard(newTitle)).toBeVisible();
    },
  );

  test(
    'UI-NOTE-03: delete via the confirmation modal removes the note',
    { tag: '@regression' },
    async ({ signedInPage, notesPage }) => {
      void signedInPage;
      const title = `del ${Date.now()}`;
      await notesPage.createNote(title, 'to be deleted');
      await expect(notesPage.noteCard(title)).toBeVisible();

      await notesPage.deleteNote(title);
      await expect(notesPage.noteCard(title)).toHaveCount(0);
    },
  );

  test(
    'UI-NOTE-04: cancelling deletion keeps the note',
    { tag: '@regression' },
    async ({ signedInPage, notesPage }) => {
      void signedInPage;
      const title = `keep ${Date.now()}`;
      await notesPage.createNote(title, 'keep me');

      await notesPage.startDelete(title);
      await notesPage.cancelDelete();
      await expect(notesPage.noteCard(title)).toBeVisible();
    },
  );

  test(
    'UI-NOTE-05: list + counter update live on create then delete',
    { tag: '@regression' },
    async ({ signedInPage, notesPage }) => {
      void signedInPage;
      await expect(notesPage.totalLabel).toContainText('0');

      const title = `live ${Date.now()}`;
      await notesPage.createNote(title, 'x');
      await expect(notesPage.totalLabel).toContainText('1');

      await notesPage.deleteNote(title);
      await expect(notesPage.totalLabel).toContainText('0');
    },
  );

  test(
    'UI-NOTE-06: an invalid create is surfaced and not added',
    { tag: '@regression' },
    async ({ signedInPage, notesPage }) => {
      void signedInPage;
      // Content is not required client-side, so empty content reaches the API (422).
      const title = `invalid ${Date.now()}`;
      await notesPage.titleInput.fill(title);
      await notesPage.contentInput.fill('');
      await notesPage.createForm.getByRole('button', { name: /create|save|add/i }).click();

      await expect(notesPage.status).toContainText(/content/i);
      await expect(notesPage.noteCard(title)).toHaveCount(0);
    },
  );

  test(
    'UI-NOTE-07: note content is rendered',
    { tag: '@regression' },
    async ({ signedInPage, notesPage }) => {
      void signedInPage;
      const title = `render ${Date.now()}`;
      const content = `distinctive-content-${Date.now()}`;
      await notesPage.createNote(title, content);
      await expect(notesPage.noteCard(title)).toContainText(content);
    },
  );

  test(
    'UI-NOTE-08: script/HTML in a note is escaped in the browser (no XSS)',
    { tag: '@regression' },
    async ({ signedInPage, notesPage }) => {
      void signedInPage;
      const title = `xss ${Date.now()}`;
      await notesPage.createNote(
        title,
        '<img src=x onerror=window.__xss=1><script>window.__xss=1</script>',
      );
      const card = notesPage.noteCard(title);
      await expect(card).toBeVisible();

      expect(
        await signedInPage.evaluate(() => (window as Window & { __xss?: number }).__xss ?? null),
      ).toBeNull();
      expect(await card.locator('script, img').count()).toBe(0);
    },
  );

  // 🐞 Defect (verified) — the edit modal discards typed input on a validation error.
  test(
    'UI-NOTE-10: the edit modal loses input on a validation error (defect)',
    { tag: '@regression' },
    async ({ signedInPage, notesPage }) => {
      void signedInPage;
      const title = `editfail ${Date.now()}`;
      await notesPage.createNote(title, 'original');

      await notesPage.startEdit(title);
      // A 256-char title passes client checks but fails server validation (422).
      await notesPage.modal.locator('[name="title"]').fill('T'.repeat(256));
      await notesPage.modal.getByRole('button', { name: /save|update/i }).click();

      // Expected (correct): modal stays open with the error inline + input preserved.
      await expect(notesPage.modal).toBeHidden();
      await expect(notesPage.status).toContainText(/title/i);
      await expect(notesPage.noteCard(title)).toBeVisible(); // original unchanged
    },
  );
});
