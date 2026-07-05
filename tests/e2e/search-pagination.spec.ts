import { test, expect } from '../fixtures/e2e.fixture';
import { seedNotesWithTitles } from '../utils/notes';

/**
 * Search & pagination control wiring.
 * @regression — UI-SP-01…05, 07. Data is API-seeded; the tests assert the controls
 *   drive the list (the query logic itself is API-tested).
 */
test.describe('UI — Search & pagination', () => {
  test(
    'UI-SP-01: search narrows the visible list',
    { tag: '@regression' },
    async ({ signedInPage, notesPage, seededNotesApi }) => {
      const token = `sp01${Date.now()}`;
      await seedNotesWithTitles(seededNotesApi, [`Apple ${token}`, 'Banana', 'Cherry']);
      await signedInPage.reload();
      // Settle the default load before searching, else its response can land after
      // the search and clobber the filtered list (race under parallel load).
      await expect(notesPage.notesList.locator('h3')).toHaveCount(3);

      await notesPage.search(token);
      await expect(notesPage.notesList.locator('h3')).toHaveCount(1);
      await expect(notesPage.notesList.locator('h3')).toHaveText(`Apple ${token}`);
    },
  );

  test(
    'UI-SP-02: the sort control reorders the list',
    { tag: '@regression' },
    async ({ signedInPage, notesPage, seededNotesApi }) => {
      await seedNotesWithTitles(seededNotesApi, ['Cherry', 'Apple', 'Banana']);
      await signedInPage.reload();
      // Settle the default load before sorting (see UI-SP-01 note).
      await expect(notesPage.notesList.locator('h3')).toHaveCount(3);

      await notesPage.searchSort.selectOption({ label: 'Title (A-Z)' });
      await expect(notesPage.notesList.locator('h3')).toHaveText(['Apple', 'Banana', 'Cherry']);
    },
  );

  test(
    'UI-SP-03: paging changes the page',
    { tag: '@regression' },
    async ({ signedInPage, notesPage, seededNotesApi }) => {
      await seedNotesWithTitles(
        seededNotesApi,
        Array.from({ length: 6 }, (_, i) => `Note ${String(i).padStart(2, '0')}`),
      );
      await signedInPage.reload();
      // Settle the default-size load before resizing (see UI-SP-04 note) so the
      // initial fetch can't land late and clobber the resized list under load.
      await expect(notesPage.notesList.locator('h3')).toHaveCount(6);
      await notesPage.pageSize.selectOption('5');

      await expect(notesPage.notesList.locator('h3')).toHaveCount(5);
      await notesPage.nextPage.click();
      await expect(notesPage.notesList.locator('h3')).toHaveCount(1);
      await expect(notesPage.pageInfo).toContainText(/2/);

      await notesPage.prevPage.click();
      await expect(notesPage.notesList.locator('h3')).toHaveCount(5);
    },
  );

  test(
    'UI-SP-04: the page-size control limits the visible count',
    { tag: '@regression' },
    async ({ signedInPage, notesPage, seededNotesApi }) => {
      await seedNotesWithTitles(seededNotesApi, Array.from({ length: 6 }, (_, i) => `Item ${i}`));
      await signedInPage.reload();
      // Let the default-size load settle first; otherwise its response can land
      // after the resize request and overwrite the list back to 6 (race under load).
      await expect(notesPage.notesList.locator('h3')).toHaveCount(6);

      await notesPage.pageSize.selectOption('5');
      await expect(notesPage.notesList.locator('h3')).toHaveCount(5);
    },
  );

  test(
    'UI-SP-05: searching for nothing shows an empty state (no error)',
    { tag: '@regression' },
    async ({ signedInPage, notesPage, seededNotesApi }) => {
      await seedNotesWithTitles(seededNotesApi, ['Something']);
      await signedInPage.reload();
      // Settle the default load before searching (see UI-SP-01 note).
      await expect(notesPage.notesList.locator('h3')).toHaveCount(1);

      await notesPage.search(`missing${Date.now()}`);
      await expect(notesPage.notesList).toContainText(/no notes/i);
      await expect(notesPage.notesList.locator('h3')).toHaveCount(0);
    },
  );

  // 🐞 Defect (verified) — the total label counts the current page, not the grand total.
  test(
    'UI-SP-07: the total label reflects the page count, not the real total (defect)',
    { tag: '@regression' },
    async ({ signedInPage, notesPage, seededNotesApi }) => {
      await seedNotesWithTitles(
        seededNotesApi,
        Array.from({ length: 12 }, (_, i) => `Bulk ${String(i).padStart(2, '0')}`),
      );
      await signedInPage.reload(); // default page size is 10

      await expect(notesPage.notesList.locator('h3')).toHaveCount(10);
      // Expected (correct): shows 12 (the true total). Actual: shows 10 (this page).
      await expect(notesPage.totalLabel).toContainText('10');
    },
  );
});
