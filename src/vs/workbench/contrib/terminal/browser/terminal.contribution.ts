/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import * as platform from 'vs/base/common/platform';
import 'vs/css!./media/scrollbar';
import 'vs/css!./media/terminal';
import 'vs/css!./media/widgets';
import 'vs/css!./media/xterm';
import * as nls from 'vs/nls';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { ContextKeyExpr, ContextKeyExpression } from 'vs/platform/contextkey/common/contextkey';
import { KeybindingWeight, KeybindingsRegistry, IKeybindings } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import * as panel from 'vs/workbench/browser/panel';
import { getQuickNavigateHandler } from 'vs/workbench/browser/quickaccess';
import { Extensions as ActionExtensions, IWorkbenchActionRegistry } from 'vs/workbench/common/actions';
import { Extensions as ViewContainerExtensions, IViewContainersRegistry, ViewContainerLocation, IViewsRegistry } from 'vs/workbench/common/views';
import { registerTerminalActions, ClearTerminalAction, CopyTerminalSelectionAction, CreateNewInActiveWorkspaceTerminalAction, CreateNewTerminalAction, FocusActiveTerminalAction, FocusNextPaneTerminalAction, FocusNextTerminalAction, FocusPreviousPaneTerminalAction, FocusPreviousTerminalAction, KillTerminalAction, ResizePaneDownTerminalAction, ResizePaneLeftTerminalAction, ResizePaneRightTerminalAction, ResizePaneUpTerminalAction, RunActiveFileInTerminalAction, RunSelectedTextInTerminalAction, ScrollDownPageTerminalAction, ScrollDownTerminalAction, ScrollToBottomTerminalAction, ScrollToTopTerminalAction, ScrollUpPageTerminalAction, ScrollUpTerminalAction, SelectAllTerminalAction, SelectDefaultShellWindowsTerminalAction, SplitInActiveWorkspaceTerminalAction, SplitTerminalAction, TerminalPasteAction, ToggleTerminalAction, NavigationModeFocusPreviousTerminalAction, NavigationModeFocusNextTerminalAction, NavigationModeExitTerminalAction, terminalSendSequenceCommand } from 'vs/workbench/contrib/terminal/browser/terminalActions';
import { TerminalViewPane } from 'vs/workbench/contrib/terminal/browser/terminalView';
import { KEYBINDING_CONTEXT_TERMINAL_SHELL_TYPE_KEY, KEYBINDING_CONTEXT_TERMINAL_FOCUS, KEYBINDING_CONTEXT_TERMINAL_TEXT_SELECTED, TERMINAL_VIEW_ID, TERMINAL_ACTION_CATEGORY, KEYBINDING_CONTEXT_TERMINAL_A11Y_TREE_FOCUS, TERMINAL_COMMAND_ID } from 'vs/workbench/contrib/terminal/common/terminal';
import { registerColors } from 'vs/workbench/contrib/terminal/common/terminalColorRegistry';
import { setupTerminalCommands } from 'vs/workbench/contrib/terminal/browser/terminalCommands';
import { setupTerminalMenu } from 'vs/workbench/contrib/terminal/common/terminalMenu';
import { IConfigurationRegistry, Extensions } from 'vs/platform/configuration/common/configurationRegistry';
import { TerminalService } from 'vs/workbench/contrib/terminal/browser/terminalService';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from 'vs/platform/accessibility/common/accessibility';
import { ITerminalService, WindowsShellType } from 'vs/workbench/contrib/terminal/browser/terminal';
import { BrowserFeatures } from 'vs/base/browser/canIUse';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { ViewPaneContainer } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { IQuickAccessRegistry, Extensions as QuickAccessExtensions } from 'vs/platform/quickinput/common/quickAccess';
import { TerminalQuickAccessProvider } from 'vs/workbench/contrib/terminal/browser/terminalsQuickAccess';
import { terminalConfiguration, getTerminalShellConfiguration } from 'vs/workbench/contrib/terminal/common/terminalConfiguration';

// Register services
registerSingleton(ITerminalService, TerminalService, true);

// Register quick accesses
const quickAccessRegistry = (Registry.as<IQuickAccessRegistry>(QuickAccessExtensions.Quickaccess));
const inTerminalsPicker = 'inTerminalPicker';
quickAccessRegistry.registerQuickAccessProvider({
	ctor: TerminalQuickAccessProvider,
	prefix: TerminalQuickAccessProvider.PREFIX,
	contextKey: inTerminalsPicker,
	placeholder: nls.localize('tasksQuickAccessPlaceholder', "Type the name of a terminal to open."),
	helpEntries: [{ description: nls.localize('tasksQuickAccessHelp', "Show All Opened Terminals"), needsEditor: false }]
});
const quickAccessNavigateNextInTerminalPickerId = 'workbench.action.quickOpenNavigateNextInTerminalPicker';
CommandsRegistry.registerCommand({ id: quickAccessNavigateNextInTerminalPickerId, handler: getQuickNavigateHandler(quickAccessNavigateNextInTerminalPickerId, true) });
const quickAccessNavigatePreviousInTerminalPickerId = 'workbench.action.quickOpenNavigatePreviousInTerminalPicker';
CommandsRegistry.registerCommand({ id: quickAccessNavigatePreviousInTerminalPickerId, handler: getQuickNavigateHandler(quickAccessNavigatePreviousInTerminalPickerId, false) });

// Register configurations
const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
configurationRegistry.registerConfiguration(terminalConfiguration);
if (platform.isWeb) {
	// Desktop shell configuration are registered in electron-browser as their default values rely
	// on process.env
	configurationRegistry.registerConfiguration(getTerminalShellConfiguration());
}

// Register views
const VIEW_CONTAINER = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: TERMINAL_VIEW_ID,
	name: nls.localize('terminal', "Terminal"),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [TERMINAL_VIEW_ID, TERMINAL_VIEW_ID, { mergeViewWithContainerWhenSingleView: true, donotShowContainerTitleWhenMergedWithContainer: true }]),
	focusCommand: { id: TERMINAL_COMMAND_ID.FOCUS },
	hideIfEmpty: true,
	order: 3
}, ViewContainerLocation.Panel);
Registry.as<panel.PanelRegistry>(panel.Extensions.Panels).setDefaultPanelId(TERMINAL_VIEW_ID);
Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([{
	id: TERMINAL_VIEW_ID,
	name: nls.localize('terminal', "Terminal"),
	containerIcon: 'codicon-terminal',
	canToggleVisibility: false,
	canMoveView: true,
	ctorDescriptor: new SyncDescriptor(TerminalViewPane)
}], VIEW_CONTAINER);

// Register actions
const actionRegistry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
const category = TERMINAL_ACTION_CATEGORY;
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(KillTerminalAction, KillTerminalAction.ID, KillTerminalAction.LABEL), 'Terminal: Kill the Active Terminal Instance', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(CreateNewTerminalAction, CreateNewTerminalAction.ID, CreateNewTerminalAction.LABEL, {
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.US_BACKTICK,
	mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.US_BACKTICK }
}), 'Terminal: Create New Integrated Terminal', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(CreateNewInActiveWorkspaceTerminalAction, CreateNewInActiveWorkspaceTerminalAction.ID, CreateNewInActiveWorkspaceTerminalAction.LABEL), 'Terminal: Create New Integrated Terminal (In Active Workspace)', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(FocusActiveTerminalAction, FocusActiveTerminalAction.ID, FocusActiveTerminalAction.LABEL), 'Terminal: Focus Terminal', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(FocusNextTerminalAction, FocusNextTerminalAction.ID, FocusNextTerminalAction.LABEL), 'Terminal: Focus Next Terminal', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(FocusPreviousTerminalAction, FocusPreviousTerminalAction.ID, FocusPreviousTerminalAction.LABEL), 'Terminal: Focus Previous Terminal', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(SelectAllTerminalAction, SelectAllTerminalAction.ID, SelectAllTerminalAction.LABEL, {
	// Don't use ctrl+a by default as that would override the common go to start
	// of prompt shell binding
	primary: 0,
	// Technically this doesn't need to be here as it will fall back to this
	// behavior anyway when handed to xterm.js, having this handled by VS Code
	// makes it easier for users to see how it works though.
	mac: { primary: KeyMod.CtrlCmd | KeyCode.KEY_A }
}, KEYBINDING_CONTEXT_TERMINAL_FOCUS), 'Terminal: Select All', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(RunSelectedTextInTerminalAction, RunSelectedTextInTerminalAction.ID, RunSelectedTextInTerminalAction.LABEL), 'Terminal: Run Selected Text In Active Terminal', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(RunActiveFileInTerminalAction, RunActiveFileInTerminalAction.ID, RunActiveFileInTerminalAction.LABEL), 'Terminal: Run Active File In Active Terminal', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(ToggleTerminalAction, ToggleTerminalAction.ID, ToggleTerminalAction.LABEL, {
	primary: KeyMod.CtrlCmd | KeyCode.US_BACKTICK,
	mac: { primary: KeyMod.WinCtrl | KeyCode.US_BACKTICK }
}), 'View: Toggle Integrated Terminal', nls.localize('viewCategory', "View"));
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(ScrollDownTerminalAction, ScrollDownTerminalAction.ID, ScrollDownTerminalAction.LABEL, {
	primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.PageDown,
	linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.DownArrow }
}, KEYBINDING_CONTEXT_TERMINAL_FOCUS), 'Terminal: Scroll Down (Line)', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(ScrollDownPageTerminalAction, ScrollDownPageTerminalAction.ID, ScrollDownPageTerminalAction.LABEL, {
	primary: KeyMod.Shift | KeyCode.PageDown,
	mac: { primary: KeyCode.PageDown }
}, KEYBINDING_CONTEXT_TERMINAL_FOCUS), 'Terminal: Scroll Down (Page)', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(ScrollToBottomTerminalAction, ScrollToBottomTerminalAction.ID, ScrollToBottomTerminalAction.LABEL, {
	primary: KeyMod.CtrlCmd | KeyCode.End,
	linux: { primary: KeyMod.Shift | KeyCode.End }
}, KEYBINDING_CONTEXT_TERMINAL_FOCUS), 'Terminal: Scroll to Bottom', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(ScrollUpTerminalAction, ScrollUpTerminalAction.ID, ScrollUpTerminalAction.LABEL, {
	primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.PageUp,
	linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.UpArrow },
}, KEYBINDING_CONTEXT_TERMINAL_FOCUS), 'Terminal: Scroll Up (Line)', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(ScrollUpPageTerminalAction, ScrollUpPageTerminalAction.ID, ScrollUpPageTerminalAction.LABEL, {
	primary: KeyMod.Shift | KeyCode.PageUp,
	mac: { primary: KeyCode.PageUp }
}, KEYBINDING_CONTEXT_TERMINAL_FOCUS), 'Terminal: Scroll Up (Page)', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(ScrollToTopTerminalAction, ScrollToTopTerminalAction.ID, ScrollToTopTerminalAction.LABEL, {
	primary: KeyMod.CtrlCmd | KeyCode.Home,
	linux: { primary: KeyMod.Shift | KeyCode.Home }
}, KEYBINDING_CONTEXT_TERMINAL_FOCUS), 'Terminal: Scroll to Top', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(ClearTerminalAction, ClearTerminalAction.ID, ClearTerminalAction.LABEL, {
	primary: 0,
	mac: { primary: KeyMod.CtrlCmd | KeyCode.KEY_K }
}, KEYBINDING_CONTEXT_TERMINAL_FOCUS, KeybindingWeight.WorkbenchContrib + 1), 'Terminal: Clear', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(SelectDefaultShellWindowsTerminalAction, SelectDefaultShellWindowsTerminalAction.ID, SelectDefaultShellWindowsTerminalAction.LABEL), 'Terminal: Select Default Shell', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(SplitTerminalAction, SplitTerminalAction.ID, SplitTerminalAction.LABEL, {
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_5,
	mac: {
		primary: KeyMod.CtrlCmd | KeyCode.US_BACKSLASH,
		secondary: [KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KEY_5]
	}
}, KEYBINDING_CONTEXT_TERMINAL_FOCUS), 'Terminal: Split Terminal', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(SplitInActiveWorkspaceTerminalAction, SplitInActiveWorkspaceTerminalAction.ID, SplitInActiveWorkspaceTerminalAction.LABEL), 'Terminal: Split Terminal (In Active Workspace)', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(FocusPreviousPaneTerminalAction, FocusPreviousPaneTerminalAction.ID, FocusPreviousPaneTerminalAction.LABEL, {
	primary: KeyMod.Alt | KeyCode.LeftArrow,
	secondary: [KeyMod.Alt | KeyCode.UpArrow],
	mac: {
		primary: KeyMod.Alt | KeyMod.CtrlCmd | KeyCode.LeftArrow,
		secondary: [KeyMod.Alt | KeyMod.CtrlCmd | KeyCode.UpArrow]
	}
}, KEYBINDING_CONTEXT_TERMINAL_FOCUS), 'Terminal: Focus Previous Pane', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(FocusNextPaneTerminalAction, FocusNextPaneTerminalAction.ID, FocusNextPaneTerminalAction.LABEL, {
	primary: KeyMod.Alt | KeyCode.RightArrow,
	secondary: [KeyMod.Alt | KeyCode.DownArrow],
	mac: {
		primary: KeyMod.Alt | KeyMod.CtrlCmd | KeyCode.RightArrow,
		secondary: [KeyMod.Alt | KeyMod.CtrlCmd | KeyCode.DownArrow]
	}
}, KEYBINDING_CONTEXT_TERMINAL_FOCUS), 'Terminal: Focus Next Pane', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(ResizePaneLeftTerminalAction, ResizePaneLeftTerminalAction.ID, ResizePaneLeftTerminalAction.LABEL, {
	primary: 0,
	linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.LeftArrow },
	mac: { primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.LeftArrow }
}, KEYBINDING_CONTEXT_TERMINAL_FOCUS), 'Terminal: Resize Pane Left', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(ResizePaneRightTerminalAction, ResizePaneRightTerminalAction.ID, ResizePaneRightTerminalAction.LABEL, {
	primary: 0,
	linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.RightArrow },
	mac: { primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.RightArrow }
}, KEYBINDING_CONTEXT_TERMINAL_FOCUS), 'Terminal: Resize Pane Right', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(ResizePaneUpTerminalAction, ResizePaneUpTerminalAction.ID, ResizePaneUpTerminalAction.LABEL, {
	primary: 0,
	mac: { primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.UpArrow }
}, KEYBINDING_CONTEXT_TERMINAL_FOCUS), 'Terminal: Resize Pane Up', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(ResizePaneDownTerminalAction, ResizePaneDownTerminalAction.ID, ResizePaneDownTerminalAction.LABEL, {
	primary: 0,
	mac: { primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.DownArrow }
}, KEYBINDING_CONTEXT_TERMINAL_FOCUS), 'Terminal: Resize Pane Down', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(NavigationModeExitTerminalAction, NavigationModeExitTerminalAction.ID, NavigationModeExitTerminalAction.LABEL, {
	primary: KeyCode.Escape
}, ContextKeyExpr.and(KEYBINDING_CONTEXT_TERMINAL_A11Y_TREE_FOCUS, CONTEXT_ACCESSIBILITY_MODE_ENABLED)), 'Terminal: Exit Navigation Mode', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(NavigationModeFocusPreviousTerminalAction, NavigationModeFocusPreviousTerminalAction.ID, NavigationModeFocusPreviousTerminalAction.LABEL, {
	primary: KeyMod.CtrlCmd | KeyCode.UpArrow
}, ContextKeyExpr.or(ContextKeyExpr.and(KEYBINDING_CONTEXT_TERMINAL_A11Y_TREE_FOCUS, CONTEXT_ACCESSIBILITY_MODE_ENABLED), ContextKeyExpr.and(KEYBINDING_CONTEXT_TERMINAL_FOCUS, CONTEXT_ACCESSIBILITY_MODE_ENABLED))), 'Terminal: Focus Previous Line (Navigation Mode)', category);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(NavigationModeFocusNextTerminalAction, NavigationModeFocusNextTerminalAction.ID, NavigationModeFocusNextTerminalAction.LABEL, {
	primary: KeyMod.CtrlCmd | KeyCode.DownArrow
}, ContextKeyExpr.or(ContextKeyExpr.and(KEYBINDING_CONTEXT_TERMINAL_A11Y_TREE_FOCUS, CONTEXT_ACCESSIBILITY_MODE_ENABLED), ContextKeyExpr.and(KEYBINDING_CONTEXT_TERMINAL_FOCUS, CONTEXT_ACCESSIBILITY_MODE_ENABLED))), 'Terminal: Focus Next Line (Navigation Mode)', category);

registerTerminalActions();

// Commands might be affected by Web restrictons
if (BrowserFeatures.clipboard.writeText) {
	actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(CopyTerminalSelectionAction, CopyTerminalSelectionAction.ID, CopyTerminalSelectionAction.LABEL, {
		primary: KeyMod.CtrlCmd | KeyCode.KEY_C,
		win: { primary: KeyMod.CtrlCmd | KeyCode.KEY_C, secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_C] },
		linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_C }
	}, ContextKeyExpr.and(KEYBINDING_CONTEXT_TERMINAL_TEXT_SELECTED, KEYBINDING_CONTEXT_TERMINAL_FOCUS)), 'Terminal: Copy Selection', category);
}

function registerSendSequenceKeybinding(text: string, rule: { when?: ContextKeyExpression } & IKeybindings): void {
	KeybindingsRegistry.registerCommandAndKeybindingRule({
		id: TERMINAL_COMMAND_ID.SEND_SEQUENCE,
		weight: KeybindingWeight.WorkbenchContrib,
		when: rule.when || KEYBINDING_CONTEXT_TERMINAL_FOCUS,
		primary: rule.primary,
		mac: rule.mac,
		linux: rule.linux,
		win: rule.win,
		handler: terminalSendSequenceCommand,
		args: { text }
	});
}

if (BrowserFeatures.clipboard.readText) {
	actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(TerminalPasteAction, TerminalPasteAction.ID, TerminalPasteAction.LABEL, {
		primary: KeyMod.CtrlCmd | KeyCode.KEY_V,
		win: { primary: KeyMod.CtrlCmd | KeyCode.KEY_V, secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_V] },
		linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_V }
	}, KEYBINDING_CONTEXT_TERMINAL_FOCUS), 'Terminal: Paste into Active Terminal', category);
	// An extra Windows-only ctrl+v keybinding is used for pwsh that sends ctrl+v directly to the
	// shell, this gets handled by PSReadLine which properly handles multi-line pastes
	if (platform.isWindows) {
		registerSendSequenceKeybinding(String.fromCharCode('V'.charCodeAt(0) - 64), { // ctrl+v
			when: ContextKeyExpr.and(KEYBINDING_CONTEXT_TERMINAL_FOCUS, ContextKeyExpr.equals(KEYBINDING_CONTEXT_TERMINAL_SHELL_TYPE_KEY, WindowsShellType.PowerShell)),
			primary: KeyMod.CtrlCmd | KeyCode.KEY_V
		});
	}
}

// Delete word left: ctrl+w
registerSendSequenceKeybinding(String.fromCharCode('W'.charCodeAt(0) - 64), {
	primary: KeyMod.CtrlCmd | KeyCode.Backspace,
	mac: { primary: KeyMod.Alt | KeyCode.Backspace }
});
// Delete word right: alt+d
registerSendSequenceKeybinding('\x1bd', {
	primary: KeyMod.CtrlCmd | KeyCode.Delete,
	mac: { primary: KeyMod.Alt | KeyCode.Delete }
});
// Delete to line start: ctrl+u
registerSendSequenceKeybinding('\u0015', {
	mac: { primary: KeyMod.CtrlCmd | KeyCode.Backspace }
});
// Move to line start: ctrl+A
registerSendSequenceKeybinding(String.fromCharCode('A'.charCodeAt(0) - 64), {
	mac: { primary: KeyMod.CtrlCmd | KeyCode.LeftArrow }
});
// Move to line end: ctrl+E
registerSendSequenceKeybinding(String.fromCharCode('E'.charCodeAt(0) - 64), {
	mac: { primary: KeyMod.CtrlCmd | KeyCode.RightArrow }
});

setupTerminalCommands();
setupTerminalMenu();

registerColors();
