import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/** Notes list, create/edit form, search + pagination controls, delete modal. */
export class NotesPage extends BasePage {
  readonly view: Locator;
  readonly navNotesButton: Locator;
  readonly logoutButton: Locator;

  // Create form
  readonly createForm: Locator;
  readonly titleInput: Locator;
  readonly contentInput: Locator;

  // List
  readonly notesList: Locator;
  readonly totalLabel: Locator;

  // Search
  readonly searchForm: Locator;
  readonly searchQuery: Locator;
  readonly searchField: Locator;
  readonly searchSort: Locator;

  // Pagination
  readonly pageSize: Locator;
  readonly pageInfo: Locator;
  readonly prevPage: Locator;
  readonly nextPage: Locator;

  constructor(page: Page) {
    super(page);
    this.view = page.locator('#notes-view');
    this.navNotesButton = page.locator('#nav-notes-button');
    this.logoutButton = page.locator('#logout-button');

    this.createForm = page.locator('#create-note-form');
    this.titleInput = page.locator('#note-title');
    this.contentInput = page.locator('#note-content');

    this.notesList = page.locator('#notes-list');
    this.totalLabel = page.locator('#notes-list-total');

    this.searchForm = page.locator('#search-notes-form');
    this.searchQuery = page.locator('#notes-search-query');
    this.searchField = page.locator('#notes-search-field');
    this.searchSort = page.locator('#notes-search-sort');

    this.pageSize = page.locator('#notes-page-size');
    this.pageInfo = page.locator('#notes-page-info');
    this.prevPage = page.locator('#notes-prev-page');
    this.nextPage = page.locator('#notes-next-page');
  }

  /** The open modal dialog (edit or delete confirmation). */
  get modal(): Locator {
    return this.page.getByRole('dialog');
  }

  /** A single note card in the list, located by its visible title. */
  noteCard(title: string): Locator {
    return this.notesList.locator('.panel', { hasText: title });
  }

  async createNote(title: string, content: string): Promise<void> {
    await this.titleInput.fill(title);
    await this.contentInput.fill(content);
    await this.createForm.getByRole('button', { name: /create|save|add/i }).click();
  }

  async search(query: string): Promise<void> {
    await this.searchQuery.fill(query);
    await this.searchQuery.press('Enter');
  }

  /** Open the Update modal for a note. */
  async startEdit(title: string): Promise<void> {
    await this.noteCard(title).getByRole('button', { name: /update|edit/i }).click();
  }

  /** Fill + save the open Update modal. */
  async saveEdit(newTitle: string, newContent: string): Promise<void> {
    await this.modal.locator('[name="title"]').fill(newTitle);
    await this.modal.locator('[name="content"]').fill(newContent);
    await this.modal.getByRole('button', { name: /save|update/i }).click();
  }

  async editNote(title: string, newTitle: string, newContent: string): Promise<void> {
    await this.startEdit(title);
    await this.saveEdit(newTitle, newContent);
  }

  /** Open the Delete confirmation modal for a note. */
  async startDelete(title: string): Promise<void> {
    await this.noteCard(title).getByRole('button', { name: /delete/i }).click();
  }

  async confirmDelete(): Promise<void> {
    await this.page.locator('.modal-actions').getByRole('button', { name: /delete/i }).click();
  }

  async cancelDelete(): Promise<void> {
    await this.page.locator('.modal-actions').getByRole('button', { name: /cancel/i }).click();
  }

  /** Click Delete on a note card and confirm in the modal. */
  async deleteNote(title: string): Promise<void> {
    await this.startDelete(title);
    await this.confirmDelete();
  }
}
