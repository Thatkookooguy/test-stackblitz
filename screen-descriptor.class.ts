/**
 * @internal
 * This is a doc comment for a dynamic module.
 */

import { Validators } from '@angular/forms';
import { isObject, toString, get, forEach, startCase, defaults, isNil, includes } from 'lodash';
import { BASE_API_PATH, BASE_UI_PATH } from './common/consts';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { CustomActionsService } from './custom-actions.service';

export enum Mode {
  View,
  Create,
  Edit
}
export interface AvailableActions {
  /**
   * should this screen have an option to view a single model?
   */
  view: boolean;
  /**
   * should this screen have an option to edit a single model?
   */
  edit: boolean;
  /**
   * should this screen have an option to create a new model?
   */
  create: boolean;
  /**
   * custom actions. not supported yet.
   * TODO: add the ability to create custom actions.
   */
  [key: string]: boolean | CspCustomAction;
}

export interface CspModelField {
  /**
   * Validators to be applied when editing the field
   * or creating a new instance.
   * this accepts [@angular/form validators](https://angular.io/api/forms/Validators)
   */
  validations: Validators[];
  /**
   * type of this field. if a custom field isn't found,
   * the field type is regarded as string
   */
  type: string;
  /**
   * default value to set for the field.
   * this is usually empty but can be defined to
   * initialize things like booleans for example.
   */
  defaultValue: any;
  map?: string;
  modelId?: boolean;
}

export type CspPrompt = (form: CspModelField[]) => Observable<any>;

export type CspCustomAction = (
  item: any,
  screen: CspScreen,
  customActionsService: CustomActionsService
) => Observable<any>;

export interface CspCustomActionObject {
  name: string;
  action: CspCustomAction;
}
export interface CspModel {
  [key: string]: CspModelField;
}

/**
  * blah?
  */
export interface ScreenDescriptor {
  /**
   * Name of the screen.
   * Should be identical to the model name but in plural
   */
  name: string;
  icon?: string;
  apiUrlPrefix?: string;
  /**
   * Should this screen be shown in the sidebar navigator?
   * Defaults to `true`
   */
  includeInNavigator?: boolean;
  /**
   * Select which Fields should be shown in the screen's table.
   * If not defined, no table will be shown
   */
  tableColumns?: string[];
  /**
   * Define which actions are available on the screen\model.
   * view and edit will enable those views in the modal,
   * while create will enable an action to create a new model.
   * Everything else will be considered as a custom action
   * and will render a new button on the model's screen.
   */
  availableActions: AvailableActions;
  /**
   * Define this screen's model. This basically defines
   * the type of each field and it's validations. Also,
   * this defines a few metadata attributes like mapping an
   * attribute to the model's id (if not named `id` already)
   */
  model: CspModel;
}

export interface CspType {
  name: string;
  type: string;
}

export class CspScreen {
  name: string;
  icon?: string;
  apiUrlPrefix?: string;
  /**
   * Should this screen be shown in the sidebar navigator?
   * Defaults to `true`
   */
  includeInNavigator?: boolean;
  /**
   * Select which Fields should be shown in the screen's table.
   * If not defined, no table will be shown
   */
  tableColumns?: string[];
  /**
   * Define which actions are available on the screen\model.
   * view and edit will enable those views in the modal,
   * while create will enable an action to create a new model.
   * Everything else will be considered as a custom action
   * and will render a new button on the model's screen.
   */
  availableActions: AvailableActions;
  /**
   * Define this screen's model. This basically defines
   * the type of each field and it's validations. Also,
   * this defines a few metadata attributes like mapping an
   * attribute to the model's id (if not named `id` already)
   */
  model: CspModel;

  constructor(screenDescriptor: ScreenDescriptor) {
    Object.assign(this, defaults(
      screenDescriptor,
      { tableColumns: [] },
      { includeInNavigator: true }));
  }

  /**
   * Name of the screen in [`startCase`](https://lodash.com/docs/4.17.11#startCase).
   * useful for titles.
   */
  get displayName(): string {
    return startCase(this.name);
  }

  /**
   * generate a data structure to use with angular reactive forms
   * from the model. Can be given an existing model object as default
   * values (for example: 'edit' mode).
   */
  getForm(initialValues: { [key: string]: any } = {}, mode?: Mode): { [key: string]: any; } {
    const model = this.model;
    const formGroup: { [key: string]: any; } = {};

    forEach(model, (field: CspModelField, fieldName: string) => {
      if (!isNil(mode) && mode !== Mode.View && fieldName === this.getIdFieldName()) {
        return;
      }

      // if (field.type === 'named-list') {
      //   formGroup[fieldName] = [
      //     get(initialValues, fieldName) || field.defaultValue,
      //     field.validations
      //   ];
      // }

      const value = get(initialValues, fieldName) || field.defaultValue;

      formGroup[fieldName] = [
        isObject(value) ? stringify(value) : value,
        field.validations,
        null
      ];
    });

    return formGroup;
  }

  /**
   * generate array of fields with name and types
   */
  getTypes(mode?: Mode): CspType[] {
    const model = this.model;
    const types: CspType[] = [];

    forEach(model, (field: CspModelField, fieldName: string) => {
      if (!isNil(mode) && mode !== Mode.View && fieldName === this.getIdFieldName()) {
        return;
      }

      types.push({
        type: field.type,
        name: fieldName
      });
    });

    return types;
  }

  /**
   * generate the data table data from the screen definition
   */
  getTableData() {
    if (!this.tableColumns.length) { return null; }
    const screenPath = this.name;
    const tableColumns = this.tableColumns;
    const tableStructure = tableColumns.map((fieldName) => ({
      displayName: startCase(fieldName),
      name: fieldName
    }));
    const urlPrefix = this.apiUrlPrefix ?
      this.apiUrlPrefix + '/' : '';

    return {
      name: screenPath,
      url: `${BASE_API_PATH}/${urlPrefix}${screenPath}/query`,
      tableColumns,
      tableStructure,
      defaultSort: tableColumns[0],
      idField: this.getIdFieldName()
    };
  }

  getInstanceUrl(id: string = ''): string {
    const apiModelPath = this.name;
    const urlPrefix = this.apiUrlPrefix ?
      this.apiUrlPrefix + '/' : '';

    return `${BASE_API_PATH}/${urlPrefix}${apiModelPath}/${id}`;
  }

  /**
   * get the screen's route url
   */
  getRoutePath(): string {
    const apiModelPath = this.name;

    return `${BASE_UI_PATH}/${apiModelPath}`;
  }

  getCustomActions(): CspCustomActionObject[] {
    const customActions = [];

    forEach(this.availableActions, (action, name) => {
      if (includes(['view', 'edit', 'create'], name)) { return; }

      customActions.push({ name, action });
    });

    return customActions;
  }

  getIdFieldName(): string {
    let result: string;

    forEach(this.model, (field, fieldName) => {
      if (fieldName === 'id' || field.modelId) {
        result = fieldName;

        return false;
      }
    });

    return result;
  }
}

function stringify(obj) {
  let result;
  try {
    result = JSON.stringify(obj, null, 2);
  } catch (err) {
    result = '{}';
  }

  return result;
}
