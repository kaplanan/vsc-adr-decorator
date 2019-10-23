import * as vscode from 'vscode';
const yaml = require('js-yaml');


// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext) {
	let message: string = '';

	console.log('decorator sample is activated');

	let timeout: NodeJS.Timer | undefined = undefined;

	// create a decorator type that we use to decorate small numbers
	const smallNumberDecorationType = vscode.window.createTextEditorDecorationType({
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

	// create a decorator type that we use to decorate large numbers
	const largeNumberDecorationType = vscode.window.createTextEditorDecorationType({
		cursor: 'crosshair',
		// use a themable color. See package.json for the declaration and default values.
		backgroundColor: { id: 'myextension.largeNumberBackground' }
	});

	let activeEditor = vscode.window.activeTextEditor;

	function updateDecorations() {
		if (!activeEditor) {
			return;
		}

		const text = activeEditor.document.getText();
		const docs: any = yaml.loadAll(text);

		let provider: string = '';
		for (let doc of docs) {
			if (doc['kind'] != undefined) {
				provider = 'istio';
			}
		}

		let matchClause: string = '';
		switch(provider) {
			case 'istio': {

				let filepath = activeEditor.document.uri.path.substring(0, activeEditor.document.fileName.lastIndexOf('\\'));
				filepath = filepath.substring(0, filepath.lastIndexOf('/')) + '/doc/architecture/decisions/rate_limit_adr_0001.md'.replace('c:', 'C:');
				
				

				
				//let configProps = JSON.parse(configSet);

				//let config_destination: string = configProps.destination;
				//let config_rate: string = configProps.requestrate;
				//let config_interval: string = configProps.interval;

				let config_destination: string = 'productpage';
				let config_rate: string = '90';
				let config_interval: string = '75s';

				for (let doc of docs) {
					if (doc['kind'] == 'handler') {
						let config_quota_handler = doc;
						let quotas;
						if (config_quota_handler) { quotas = config_quota_handler['spec']['params']['quotas'][0]; } 
						else { return 'No memquota found in this template file'; }
        				let template_rate = quotas['maxAmount'];
        				let template_interval = quotas['validDuration'];
        				let overrides: {[key: string]: {[key: string]: string}}[] = quotas['overrides'];
        				let quota_override: {[key: string]: {[key: string]: string}} = {};
        				for (quota_override of overrides) {
        				    if (config_destination == quota_override['dimensions']['destination']) {
        				        template_rate = quota_override['maxAmount'];
								template_interval = quota_override['validDuration'];
								matchClause = 'destination: ' +  quota_override['dimensions']['destination'];
        				    }
						}
						let rate: string = '';
						if (config_rate != template_rate) { rate = config_rate; } else { rate = 'compliant'; }
						let interval: string = '';
						if (config_interval != template_interval) { interval = config_interval; } else { interval = 'compliant'; }
						message = 'rate: ' + rate + ' || interval: ' + interval;
					}
				}

			}
		}
		
		const regEx = new RegExp(matchClause, 'g');
		//const regEx = /dimensions+/g;
		const smallNumbers: vscode.DecorationOptions[] = [];
		const largeNumbers: vscode.DecorationOptions[] = [];
		let match;
		while (match = regEx.exec(text)) {
			const startPos = activeEditor.document.positionAt(match.index);
			const endPos = activeEditor.document.positionAt(match.index + match[0].length);

			const decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: 'Violated **' + message +  '**' };
			smallNumbers.push(decoration);

		}
		activeEditor.setDecorations(smallNumberDecorationType, smallNumbers);
		activeEditor.setDecorations(largeNumberDecorationType, largeNumbers);
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

	vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (editor) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

}

