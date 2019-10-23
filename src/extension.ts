import * as vscode from 'vscode';
const yaml = require('js-yaml');


// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext) {
	let message: string = '';

	console.log('decorator sample is activated');

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
				provider = 'istio';
				console.log("set to istio");
			} 
			if (doc['plugins'] != undefined) {
				provider = 'kong';
				console.log("set to kong");
			}
		}

		let matchClause: string = '';
		let configLookUp: {[key: string]: any} = {};

		let filepath = activeEditor.document.uri.path.substring(0, activeEditor.document.fileName.lastIndexOf('\\'));
		filepath = filepath.substring(0, filepath.lastIndexOf('/')) + '/doc/architecture/decisions/rate_limit_adr_0001.md';
		const it = await vscode.workspace.openTextDocument(filepath).then((document) => {
			let md = document.getText();
			let mdList: string[] = md.split('\n');
			let isConfig: boolean = false;
			for (let line in mdList) {
				if (!isConfig && mdList[line] == '## Config Set') {
					isConfig = true;
				} else if (isConfig) {
					let configSet = mdList[line];
					let configProps = JSON.parse(configSet);
					configLookUp['destination'] = configProps.destination;
					configLookUp['requestrate'] = configProps.requestrate;
					configLookUp['interval'] = configProps.interval;
					isConfig = false;
				}
			}
		});

		let config_destination = configLookUp['destination'];
		let config_rate = configLookUp['requestrate'];
		let config_interval = configLookUp['interval'];

		if (provider == 'istio') {
			console.log("is istio");
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
					if (rate != 'compliant' || interval != 'compliant') { 
						message = 'ADR violated: ' + '<rate: ' + rate + '> <interval: ' + interval + '>'; 
					} else {
						message = 'Compliant with ADR';
					}
				}
			}
		}

		else if (provider == 'kong') {
			console.log("is kong");
			matchClause = 'plugins';
			message = 'This is the matching property';
		}

		else {
			console.log("neither istio nor kong");
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
		// updateDecorations();
	}

	vscode.workspace.onDidSaveTextDocument(textDocument => {
		if (activeEditor && textDocument === activeEditor.document) {
			triggerUpdateDecorations();
			// updateDecorations();
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidOpenTextDocument(textDocument => {
		if (activeEditor && textDocument === activeEditor.document) {
			triggerUpdateDecorations();
			// updateDecorations();
		}
	}, null, context.subscriptions);

}

