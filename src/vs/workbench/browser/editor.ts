/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Event } from 'vs/base/common/event';
import { EditorInput, EditorResourceAccessor, IEditorInput, IEditorInputFactoryRegistry, SideBySideEditorInput, Extensions as EditorInputExtensions } from 'vs/workbench/common/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { IConstructorSignature0, IInstantiationService, BrandedService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { insert } from 'vs/base/common/arrays';
import { IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { workbenchConfigurationNodeBase } from 'vs/workbench/common/configuration';
import { Extensions as ConfigurationExtensions, IConfigurationNode, IConfigurationRegistry } from 'vs/platform/configuration/common/configurationRegistry';
import { Promises } from 'vs/base/common/async';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IUriIdentityService } from 'vs/workbench/services/uriIdentity/common/uriIdentity';
import { IWorkingCopyService } from 'vs/workbench/services/workingCopy/common/workingCopyService';
import { NO_TYPE_ID } from 'vs/workbench/services/workingCopy/common/workingCopy';
import { URI } from 'vs/workbench/workbench.web.api';
import { IEditorGroup } from 'vs/workbench/services/editor/common/editorGroupsService';

export const Extensions = {
	Editors: 'workbench.contributions.editors',
	Associations: 'workbench.editors.associations'
};

//#region Editors Registry

export interface IEditorDescriptor {

	/**
	 * The unique identifier of the editor
	 */
	getId(): string;

	/**
	 * The display name of the editor
	 */
	getName(): string;

	instantiate(instantiationService: IInstantiationService): EditorPane;

	describes(obj: unknown): boolean;
}

export interface IEditorRegistry {

	/**
	 * Registers an editor to the platform for the given input type. The second parameter also supports an
	 * array of input classes to be passed in. If the more than one editor is registered for the same editor
	 * input, the input itself will be asked which editor it prefers if this method is provided. Otherwise
	 * the first editor in the list will be returned.
	 *
	 * @param inputDescriptors A set of constructor functions that return an instance of EditorInput for which the
	 * registered editor should be used for.
	 */
	registerEditor(descriptor: IEditorDescriptor, inputDescriptors: readonly SyncDescriptor<EditorInput>[]): IDisposable;

	/**
	 * Returns the editor descriptor for the given input or `undefined` if none.
	 */
	getEditor(input: EditorInput): IEditorDescriptor | undefined;

	/**
	 * Returns the editor descriptor for the given identifier or `undefined` if none.
	 */
	getEditorById(editorId: string): IEditorDescriptor | undefined;

	/**
	 * Returns an array of registered editors known to the platform.
	 */
	getEditors(): readonly IEditorDescriptor[];
}

/**
 * A lightweight descriptor of an editor. The descriptor is deferred so that heavy editors
 * can load lazily in the workbench.
 */
export class EditorDescriptor implements IEditorDescriptor {

	static create<Services extends BrandedService[]>(
		ctor: { new(...services: Services): EditorPane },
		id: string,
		name: string
	): EditorDescriptor {
		return new EditorDescriptor(ctor as IConstructorSignature0<EditorPane>, id, name);
	}

	constructor(
		private readonly ctor: IConstructorSignature0<EditorPane>,
		private readonly id: string,
		private readonly name: string
	) { }

	instantiate(instantiationService: IInstantiationService): EditorPane {
		return instantiationService.createInstance(this.ctor);
	}

	getId(): string {
		return this.id;
	}

	getName(): string {
		return this.name;
	}

	describes(obj: unknown): boolean {
		return obj instanceof EditorPane && obj.getId() === this.id;
	}
}

class EditorRegistry implements IEditorRegistry {

	private readonly editors: EditorDescriptor[] = [];
	private readonly mapEditorToInputs = new Map<EditorDescriptor, readonly SyncDescriptor<EditorInput>[]>();

	registerEditor(descriptor: EditorDescriptor, inputDescriptors: readonly SyncDescriptor<EditorInput>[]): IDisposable {
		this.mapEditorToInputs.set(descriptor, inputDescriptors);

		const remove = insert(this.editors, descriptor);

		return toDisposable(() => {
			this.mapEditorToInputs.delete(descriptor);
			remove();
		});
	}

	getEditor(input: EditorInput): EditorDescriptor | undefined {
		const findEditorDescriptors = (input: EditorInput, byInstanceOf?: boolean): EditorDescriptor[] => {
			const matchingDescriptors: EditorDescriptor[] = [];

			for (const editor of this.editors) {
				const inputDescriptors = this.mapEditorToInputs.get(editor) || [];
				for (const inputDescriptor of inputDescriptors) {
					const inputClass = inputDescriptor.ctor;

					// Direct check on constructor type (ignores prototype chain)
					if (!byInstanceOf && input.constructor === inputClass) {
						matchingDescriptors.push(editor);
						break;
					}

					// Normal instanceof check
					else if (byInstanceOf && input instanceof inputClass) {
						matchingDescriptors.push(editor);
						break;
					}
				}
			}

			// If no descriptors found, continue search using instanceof and prototype chain
			if (!byInstanceOf && matchingDescriptors.length === 0) {
				return findEditorDescriptors(input, true);
			}

			if (byInstanceOf) {
				return matchingDescriptors;
			}

			return matchingDescriptors;
		};

		const descriptors = findEditorDescriptors(input);
		if (descriptors.length > 0) {

			// Ask the input for its preferred Editor
			const preferredEditorId = input.getPreferredEditorId(descriptors.map(descriptor => descriptor.getId()));
			if (preferredEditorId) {
				return this.getEditorById(preferredEditorId);
			}

			// Otherwise, first come first serve
			return descriptors[0];
		}

		return undefined;
	}

	getEditorById(editorId: string): EditorDescriptor | undefined {
		return this.editors.find(editor => editor.getId() === editorId);
	}

	getEditors(): readonly EditorDescriptor[] {
		return this.editors.slice(0);
	}

	getEditorInputs(): SyncDescriptor<EditorInput>[] {
		const inputClasses: SyncDescriptor<EditorInput>[] = [];
		for (const editor of this.editors) {
			const editorInputDescriptors = this.mapEditorToInputs.get(editor);
			if (editorInputDescriptors) {
				inputClasses.push(...editorInputDescriptors.map(descriptor => descriptor.ctor));
			}
		}

		return inputClasses;
	}
}

Registry.add(Extensions.Editors, new EditorRegistry());

//#endregion


//#region Editor Associations

export const editorsAssociationsSettingId = 'workbench.editorAssociations';

export const DEFAULT_EDITOR_ASSOCIATION: IEditorType = {
	id: 'default',
	displayName: localize('promptOpenWith.defaultEditor.displayName', "Text Editor"),
	providerDisplayName: localize('builtinProviderDisplayName', "Built-in")
};

export type EditorAssociation = {
	readonly viewType: string;
	readonly filenamePattern?: string;
};

export type EditorsAssociations = readonly EditorAssociation[];

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

const editorTypeSchemaAddition: IJSONSchema = {
	type: 'string',
	enum: []
};

const editorAssociationsConfigurationNode: IConfigurationNode = {
	...workbenchConfigurationNodeBase,
	properties: {
		'workbench.editorAssociations': {
			type: 'array',
			markdownDescription: localize('editor.editorAssociations', "Configure which editor to use for specific file types."),
			items: {
				type: 'object',
				defaultSnippets: [{
					body: {
						'viewType': '$1',
						'filenamePattern': '$2'
					}
				}],
				properties: {
					'viewType': {
						anyOf: [
							{
								type: 'string',
								description: localize('editor.editorAssociations.viewType', "The unique id of the editor to use."),
							},
							editorTypeSchemaAddition
						]
					},
					'filenamePattern': {
						type: 'string',
						description: localize('editor.editorAssociations.filenamePattern', "Glob pattern specifying which files the editor should be used for."),
					}
				}
			}
		}
	}
};

export interface IEditorType {
	readonly id: string;
	readonly displayName: string;
	readonly providerDisplayName: string;
}

export interface IEditorTypesHandler {
	readonly onDidChangeEditorTypes: Event<void>;

	getEditorTypes(): IEditorType[];
}

export interface IEditorAssociationsRegistry {

	/**
	 * Register handlers for editor types
	 */
	registerEditorTypesHandler(id: string, handler: IEditorTypesHandler): IDisposable;
}

class EditorAssociationsRegistry implements IEditorAssociationsRegistry {

	private readonly editorTypesHandlers = new Map<string, IEditorTypesHandler>();

	registerEditorTypesHandler(id: string, handler: IEditorTypesHandler): IDisposable {
		if (this.editorTypesHandlers.has(id)) {
			throw new Error(`An editor type handler with ${id} was already registered.`);
		}

		this.editorTypesHandlers.set(id, handler);
		this.updateEditorAssociationsSchema();

		const editorTypeChangeEvent = handler.onDidChangeEditorTypes(() => {
			this.updateEditorAssociationsSchema();
		});

		return {
			dispose: () => {
				editorTypeChangeEvent.dispose();
				this.editorTypesHandlers.delete(id);
				this.updateEditorAssociationsSchema();
			}
		};
	}

	private updateEditorAssociationsSchema() {
		const enumValues: string[] = [];
		const enumDescriptions: string[] = [];

		const editorTypes: IEditorType[] = [DEFAULT_EDITOR_ASSOCIATION];

		for (const [, handler] of this.editorTypesHandlers) {
			editorTypes.push(...handler.getEditorTypes());
		}

		for (const { id, providerDisplayName } of editorTypes) {
			enumValues.push(id);
			enumDescriptions.push(localize('editorAssociations.viewType.sourceDescription', "Source: {0}", providerDisplayName));
		}

		editorTypeSchemaAddition.enum = enumValues;
		editorTypeSchemaAddition.enumDescriptions = enumDescriptions;

		configurationRegistry.notifyConfigurationSchemaUpdated(editorAssociationsConfigurationNode);
	}
}

Registry.add(Extensions.Associations, new EditorAssociationsRegistry());
configurationRegistry.registerConfiguration(editorAssociationsConfigurationNode);

//#endregion


//#region Text Editor Close Tracker

export function whenTextEditorClosed(accessor: ServicesAccessor, resources: URI[]): Promise<void> {
	const editorService = accessor.get(IEditorService);
	const uriIdentityService = accessor.get(IUriIdentityService);
	const workingCopyService = accessor.get(IWorkingCopyService);

	const fileEditorInputFactory = Registry.as<IEditorInputFactoryRegistry>(EditorInputExtensions.EditorInputFactories).getFileEditorInputFactory();

	return new Promise(resolve => {
		let remainingResources = [...resources];

		// Observe any editor closing from this moment on
		const listener = editorService.onDidCloseEditor(async event => {
			let primaryResource: URI | undefined = undefined;
			let secondaryResource: URI | undefined = undefined;

			// Resolve the resources from the editor that closed
			// but only consider file editor inputs, given we
			// are only tracking text editors.
			if (event.editor instanceof SideBySideEditorInput) {
				if (fileEditorInputFactory.isFileEditorInput(event.editor.primary)) {
					primaryResource = EditorResourceAccessor.getOriginalUri(event.editor.primary);
				}

				if (fileEditorInputFactory.isFileEditorInput(event.editor.secondary)) {
					secondaryResource = EditorResourceAccessor.getOriginalUri(event.editor.secondary);
				}
			} else {
				if (fileEditorInputFactory.isFileEditorInput(event.editor)) {
					primaryResource = EditorResourceAccessor.getOriginalUri(event.editor);
				}
			}

			// Remove from resources to wait for being closed based on the
			// resources from editors that got closed
			remainingResources = remainingResources.filter(resource => {
				if (uriIdentityService.extUri.isEqual(resource, primaryResource) || uriIdentityService.extUri.isEqual(resource, secondaryResource)) {
					return false; // remove - the closing editor matches this resource
				}

				return true; // keep - not yet closed
			});

			// All resources to wait for being closed are closed
			if (remainingResources.length === 0) {

				// If auto save is configured with the default delay (1s) it is possible
				// to close the editor while the save still continues in the background. As such
				// we have to also check if the editors to track for are dirty and if so wait
				// for them to get saved.
				const dirtyResources = resources.filter(resource => workingCopyService.isDirty(resource, NO_TYPE_ID /* only check on text file working copies */));
				if (dirtyResources.length > 0) {
					await Promises.settled(dirtyResources.map(async resource => await new Promise<void>(resolve => {
						if (!workingCopyService.isDirty(resource, NO_TYPE_ID /* only check on text file working copies */)) {
							return resolve(); // return early if resource is not dirty
						}

						// Otherwise resolve promise when resource is saved
						const listener = workingCopyService.onDidChangeDirty(workingCopy => {
							if (!workingCopy.isDirty() && uriIdentityService.extUri.isEqual(resource, workingCopy.resource)) {
								listener.dispose();

								return resolve();
							}
						});
					})));
				}

				listener.dispose();

				return resolve();
			}
		});
	});
}

//#endregion


//#region ARIA

export function computeEditorAriaLabel(input: IEditorInput, index: number | undefined, group: IEditorGroup | undefined, groupCount: number): string {
	let ariaLabel = input.getAriaLabel();
	if (group && !group.isPinned(input)) {
		ariaLabel = localize('preview', "{0}, preview", ariaLabel);
	}

	if (group?.isSticky(index ?? input)) {
		ariaLabel = localize('pinned', "{0}, pinned", ariaLabel);
	}

	// Apply group information to help identify in
	// which group we are (only if more than one group
	// is actually opened)
	if (group && groupCount > 1) {
		ariaLabel = `${ariaLabel}, ${group.ariaLabel}`;
	}

	return ariaLabel;
}

//#endregion
