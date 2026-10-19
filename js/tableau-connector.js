/**
 * Tableau integration layer, inspired by the separation used in Matrix-Pro-Tableau.
 * Owns the Tableau API lifecycle, paginated reads, set-mark selection and parameters.
 */
import {rowToLeaf, readLeafSelection, validateLeaves} from './core.js';

export class TableauConnector {
  constructor({onDataChanged, onModeChanged} = {}) {
    this.worksheet = null;
    this.parameter = null;
    this.onDataChanged = onDataChanged ?? (() => {});
    this.onModeChanged = onModeChanged ?? (() => {});
  }

  async initialize() {
    await tableau.extensions.initializeAsync();
    this.worksheet = tableau.extensions.worksheetContent?.worksheet;
    if (!this.worksheet) throw new Error('Diese Anwendung ist eine Tableau Viz Extension.');
    const parameters = await this.worksheet.getParametersAsync();
    this.parameter = parameters.find(parameter => parameter.name === 'p.filter_modus');
    if (!this.parameter) throw new Error('Workbook-Parameter p.filter_modus fehlt.');

    this.parameter.addEventListener(tableau.TableauEventType.ParameterChanged, async event => {
      try {
        this.parameter = await event.getParameterAsync();
        this.onModeChanged(this.mode);
      } catch (error) {
        console.warn('ParameterChanged', error);
      }
    });
    this.worksheet.addEventListener(
      tableau.TableauEventType.SummaryDataChanged,
      () => this.onDataChanged()
    );
    return this.mode;
  }

  get mode() {
    return String(this.parameter?.currentValue?.value ?? 'AUSWAHL');
  }

  async changeMode(value) {
    if (!['ALLE', 'AUSWAHL', 'KEINE'].includes(value))
      throw new Error('Unbekannter Filtermodus: ' + value);
    await this.parameter.changeValueAsync(value);
    this.onModeChanged(value);
  }

  async getEncodingMap() {
    const spec = await this.worksheet.getVisualSpecificationAsync();
    const index = spec.activeMarksSpecificationIndex;
    if (index < 0) throw new Error('Kein aktiver Marks-Typ.');
    const encodings = {};
    for (const entry of spec.marksSpecifications[index].encodings)
      (encodings[entry.id] ||= []).push(entry.field);
    if (!encodings.leaf?.length || !encodings.membership?.length)
      throw new Error('Leaf ID und Set-Mitgliedschaft müssen auf dem Marks-Shelf liegen.');
    return encodings;
  }

  async readState() {
    const encodings = await this.getEncodingMap();
    const reader = await this.worksheet.getSummaryDataReaderAsync(
      undefined, {ignoreSelection: true}
    );
    const leaves = [];
    try {
      for (let pageIndex = 0; pageIndex < reader.pageCount; pageIndex++) {
        const page = await reader.getPageAsync(pageIndex);
        for (const cells of page.data) {
          const row = {};
          for (const column of page.columns)
            row[column.fieldName] = cells[column.index];
          leaves.push(rowToLeaf(row, encodings, leaves.length + 1));
        }
      }
    } finally {
      await reader.releaseAsync();
    }
    validateLeaves(leaves);
    return {leaves, selectedIds: readLeafSelection(leaves), mode: this.mode};
  }

  async selectLeaves(selectedIds, leaves) {
    const tupleIds = leaves
      .filter(leaf => selectedIds.has(leaf.id))
      .map(leaf => leaf.tupleId);
    await this.worksheet.selectTuplesAsync(tupleIds, tableau.SelectOptions.Simple);
    return tupleIds.length;
  }
}
