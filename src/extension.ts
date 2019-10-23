import * as vscode from 'vscode';
const yaml = require('js-yaml');

const COMPLIANT: string = 'compliant';
const DESTINATION: string = 'destination';
const REQUEST_RATE: string = 'requestrate';
const REQUEST_RATE_ISTIO: string = 'maxAmount'; 
const INTERVAL_ISTIO: string = 'validDuration';
const DIMENSIONS_ISTIO: string = 'dimensions';
const ISTIO: string = 'istio';
const KONG: string = 'kong';
const INTERVAL: string = 'interval';
const CONFIG_DOC: string = '## Config Set';
const ADR_DIR = '/doc/architecture/decisions/';
const ADR_FILE = 'rate_limit_adr_0001.md';

// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext) {
	let message: string = '';

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
		if (!activeEditor) {
			return;
		}

		const text = activeEditor.document.getText();
		const docs: any = yaml.loadAll(text);

		let provider: string = '';
		for (let doc of docs) {
			if (doc['kind'] != undefined) {
				provider = ISTIO;
				console.log("set to istio");
			} 
			if (doc['plugins'] != undefined) {
				provider = KONG;
				console.log("set to kong");
			}
		}

		let matchClause: string = '';
		let configLookUp: {[key: string]: any} = {};

		let filepath = activeEditor.document.uri.path.substring(0, activeEditor.document.fileName.lastIndexOf('\\'));
		filepath = filepath.substring(0, filepath.lastIndexOf('/')) + ADR_DIR + ADR_FILE;
		const it = await vscode.workspace.openTextDocument(filepath).then((document) => {
			let md = document.getText();
			let mdList: string[] = md.split('\n');
			let isConfig: boolean = false;
			for (let line in mdList) {
				if (!isConfig && mdList[line] === CONFIG_DOC) {
					isConfig = true;
				} else if (isConfig) {
					let configSet = mdList[line];
					let configProps = JSON.parse(configSet);
					configLookUp[DESTINATION] = configProps.destination;
					configLookUp[REQUEST_RATE] = configProps.requestrate;
					configLookUp[INTERVAL] = configProps.interval;
					isConfig = false;
				}
			}
		});

		let config_destination = configLookUp[DESTINATION];
		let config_rate = configLookUp[REQUEST_RATE];
		let config_interval = configLookUp[INTERVAL];

		if (provider == ISTIO) {
			console.log("is istio");
			for (let doc of docs) {
				if (doc['kind'] == 'handler') {
					let config_quota_handler = doc;
					let quotas;
					if (config_quota_handler) { quotas = config_quota_handler['spec']['params']['quotas'][0]; } 
					else { return 'No memquota found in this template file'; }
					let template_rate = quotas[REQUEST_RATE_ISTIO];
					let template_interval = quotas[REQUEST_RATE_ISTIO];
					let overrides: {[key: string]: {[key: string]: string}}[] = quotas['overrides'];
					let quota_override: {[key: string]: {[key: string]: string}} = {};
					for (quota_override of overrides) {
						if (config_destination == quota_override[DIMENSIONS_ISTIO][DESTINATION]) {
							template_rate = quota_override[REQUEST_RATE_ISTIO];
							template_interval = quota_override[REQUEST_RATE_ISTIO];
							matchClause = DESTINATION + ': ' +  quota_override[DIMENSIONS_ISTIO][DESTINATION];
						}
					}
					let rate: string = '';
					if (config_rate != template_rate) { rate = config_rate; } else { rate = COMPLIANT; }
					let interval: string = '';
					if (config_interval != template_interval) { interval = config_interval; } else { interval = COMPLIANT; }
					if (rate != COMPLIANT || interval != COMPLIANT) { 
						message = 'ADR violated: ' + '<' + REQUEST_RATE_ISTIO + rate + '> <' + INTERVAL_ISTIO + ': ' + interval + '>'; 
					} else {
						message = 'Compliant with ADR';
					}
				}
			}
		}

		else if (provider == KONG) {
			console.log("Provider: " + KONG);
			matchClause = 'plugins';
			message = 'This is the matching property';
		}

		else {
			console.log("Provider: None of " + ISTIO + " & " + KONG);
			matchClause = "nothing";
			message = "there is no annotation for this";
		}

		const regEx = new RegExp(matchClause, 'g');
		const violationTags: vscode.DecorationOptions[] = [];
		let match;
		while (match = regEx.exec(text)) {
			const startPos = activeEditor.document.positionAt(match.index);
			const endPos = activeEditor.document.positionAt(match.index + match[0].length);
			const decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: message};
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

