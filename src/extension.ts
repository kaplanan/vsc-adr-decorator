import * as vscode from 'vscode';
const yaml = require('js-yaml');

// Generic rate limit configuration terms
const COMPLIANT: string = 'compliant';
const DESTINATION: string = 'destination';
const REQUEST_RATE: string = 'requestrate';
const INTERVAL: string = 'interval';

// Istio provider related
const ISTIO: string = 'istio';
const REQUEST_RATE_ISTIO: string = 'maxAmount'; 
const INTERVAL_ISTIO: string = 'validDuration';
const DIMENSIONS_ISTIO: string = 'dimensions';

// Kong provider related
const KONG: string = 'kong';

// ADR file related
const CONFIG_DOC: string = '## Config Set';
const ADR_DIR = '/doc/architecture/decisions/';
const ADR_FILE = 'rate_limit_adr_0001.md';

// Messages
const MEMQUOTA_NOT_FOUND: string = 'No memquota found in this template file';
const ADR_COMPLIANT: string = 'Compliant with ADR';
const ADR_VIOLATED: string = 'ADR violated';


export function activate(context: vscode.ExtensionContext) {
	console.log('adr decorator is activated');
	let timeout: NodeJS.Timer | undefined = undefined;

	// create a decorator type for violation annotations
	const violationDecorationType = vscode.window.createTextEditorDecorationType({
		borderWidth: '10px',
		borderStyle: 'solid',
		overviewRulerColor: 'blue',
		overviewRulerLane: vscode.OverviewRulerLane.Right,
		light: {
			// this color will be used in light color themes
			borderColor: 'darkblue'
		},
		dark: {
			// this color will be used in dark color themes
			borderColor: 'lightblue'
		}
	});

	let activeEditor = vscode.window.activeTextEditor;

	async function updateDecorations() {
		if (!activeEditor) return;

		// --> Get the text of the current open template file
		const text = activeEditor.document.getText();
		const docs: any = yaml.loadAll(text);

		// --> Check for which provider the current template file is written
		let provider: string = '';
		for (let doc of docs) {
			if (doc['kind'] != undefined) 	 provider = ISTIO;
			if (doc['plugins'] != undefined) provider = KONG;
		}

		// READ THE ADR FILE IN THE CORRESPONDING DIRECTORY
		// --> Get the ADR file path 
		let filepath = activeEditor.document.uri.path.substring(0, activeEditor.document.fileName.lastIndexOf('\\'));
		filepath = filepath.substring(0, filepath.lastIndexOf('/')) + ADR_DIR + ADR_FILE;
		
		// --> Read the file and store the configuration in a lookup table
		let configLookUp: {[key: string]: any} = {};
		const ADRDocument = await vscode.workspace.openTextDocument(filepath).then((document) => {
			let isConfig: boolean = false;
			let mdList = document.getText().split('\n');
			for (let line in mdList) {
				if (!isConfig) {
					isConfig = (mdList[line] === CONFIG_DOC) ? true : false;
				} else {
					let configSet = mdList[line];
					let configProps = JSON.parse(configSet);
					configLookUp[DESTINATION] = configProps.destination;
					configLookUp[REQUEST_RATE] = configProps.requestrate;
					configLookUp[INTERVAL] = configProps.interval;
					isConfig = false;
				}
			}
		});

		// WRITE THE LOOKUP TABLE INTO VARIABLES
		let config_destination = configLookUp[DESTINATION];
		let config_rate = configLookUp[REQUEST_RATE];
		let config_interval = configLookUp[INTERVAL];

		// CHECK FOR COMPLIANCE FOR >>ISTIO<< TEMPLATE FILE
		let matchClause: string = '';
		let annotationTag: string = '';
		if (provider == ISTIO) {
			console.log("Provider: " + ISTIO);
			for (let doc of docs) {
				if (doc['kind'] == 'handler') {
					let config_quota_handler = doc;
					let quotas;
					if (config_quota_handler) { quotas = config_quota_handler['spec']['params']['quotas'][0]; } 
					else { return MEMQUOTA_NOT_FOUND; }
					let template_rate = quotas[REQUEST_RATE_ISTIO];
					let template_interval = quotas[REQUEST_RATE_ISTIO];
					let overrides: {[key: string]: {[key: string]: string}}[] = quotas['overrides'];
					let quota_override: {[key: string]: {[key: string]: string}} = {};
					for (quota_override of overrides) {
						if (config_destination == quota_override[DIMENSIONS_ISTIO][DESTINATION]) {
							template_rate = quota_override[REQUEST_RATE_ISTIO];
							template_interval = quota_override[INTERVAL_ISTIO];
							matchClause = DESTINATION + ': ' +  quota_override[DIMENSIONS_ISTIO][DESTINATION];
						}
					}
					let rate: string = '';
					if (config_rate != template_rate) { rate = config_rate; } else { rate = COMPLIANT; }
					let interval: string = '';
					if (config_interval != template_interval) { interval = config_interval; } else { interval = COMPLIANT; }
					if (rate != COMPLIANT || interval != COMPLIANT) { 
						annotationTag = ADR_VIOLATED + ': ' + '<' + REQUEST_RATE_ISTIO + ': ' + rate + '> <' + INTERVAL_ISTIO + ': ' + interval + '>'; 
					} else {
						annotationTag = ADR_COMPLIANT;
					}
				}
			}
		}

		// CHECK FOR COMPLIANCE FOR >>KONG<< TEMPLATE FILE
		else if (provider == KONG) {
			console.log("Provider: " + KONG);
			matchClause = 'plugins';
			annotationTag = 'This is the matching property';
		}

		// IF IT IS NOT A SUPPORTED PROVIDER IGNORE THE GIVEN FILE
		else {
			console.log("Provider: None of " + ISTIO + " & " + KONG);
			matchClause = "nothing";
			annotationTag = "there is no annotation for this";
		}

		// PUSH VIOLATION TAGS IN THE RIGHT POSITION OF THE CURRENT TEMPLATE FILE
		// --> matchClause describes for which regex the highlighting will be done
		// --> annotationTag describes the content of the highlighting when hovering over it
		const regEx = new RegExp(matchClause, 'g');
		const violationTags: vscode.DecorationOptions[] = [];
		let match;
		while (match = regEx.exec(text)) {
			const startPos = activeEditor.document.positionAt(match.index);
			const endPos = activeEditor.document.positionAt(match.index + match[0].length);
			const decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: annotationTag};
			violationTags.push(decoration);
		}
		activeEditor.setDecorations(violationDecorationType, violationTags);
	}

	function triggerUpdateDecorations() {
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		timeout = setTimeout(updateDecorations, 500);
	}

	if (activeEditor) {
		triggerUpdateDecorations();
	}

	/**
	 * Refresh the text editor content for changing to a window with
	 * another file.
	 */
	vscode.window.onDidChangeActiveTextEditor(textEditor => 
		activeEditor = textEditor, 
		null, 
		context.subscriptions
	);

	/**
	 * Evaluation everytime the user saves the file
	 */
	vscode.workspace.onDidSaveTextDocument(textDocument => {
		if (activeEditor && textDocument === activeEditor.document)
			triggerUpdateDecorations();
	}, null, context.subscriptions);

	/**
	 * Evaluation is triggered everytime the user opens a file
	 */
	vscode.workspace.onDidOpenTextDocument(textDocument => {
		if (activeEditor) {
			activeEditor = (textDocument !== activeEditor.document) 
				? vscode.window.activeTextEditor 
				: activeEditor;
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);
}

