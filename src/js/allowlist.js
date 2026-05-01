/*******************************************************************************

    uBlock Origin - a comprehensive, efficient content blocker
    Copyright (C) 2014-2018 Raymond Hill

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Home: https://github.com/gorhill/uBlock
*/

/* global CodeMirror, uBlockDashboard */

import { dom, qs$ } from './dom.js';
import { i18n$ } from './i18n.js';

/******************************************************************************/

const reComment = /^\s*#\s*/;

function directiveFromLine(line) {
    const match = reComment.exec(line);
    return match === null
        ? line.trim()
        : line.slice(match.index + match[0].length).trim();
}

/******************************************************************************/

CodeMirror.defineMode("ubo-allowlist-directives", function() {
    const reRegex = /^\/.+\/$/;

    return {
        token: function token(stream) {
            const line = stream.string.trim();
            stream.skipToEnd();
            if ( reBadHostname === undefined ) {
                return null;
            }
            if ( reComment.test(line) ) {
                return 'comment';
            }
            if ( line.indexOf('/') === -1 ) {
                if ( reBadHostname.test(line) ) { return 'error'; }
                if ( allowlistDefaultSet.has(line.trim()) ) {
                    return 'keyword';
                }
                return null;
            }
            if ( reRegex.test(line) ) {
                try {
                    new RegExp(line.slice(1, -1));
                } catch {
                    return 'error';
                }
                return null;
            }
            if ( reHostnameExtractor.test(line) === false ) {
                return 'error';
            }
            if ( allowlistDefaultSet.has(line.trim()) ) {
                return 'keyword';
            }
            return null;
        }
    };
});

let reBadHostname;
let reHostnameExtractor;
let allowlistDefaultSet = new Set();

/******************************************************************************/

const messaging = vAPI.messaging;
const noopFunc = function(){};

let cachedAllowlist = '';

const cmEditor = new CodeMirror(qs$('#allowlist'), {
    autofocus: true,
    lineNumbers: true,
    lineWrapping: true,
    styleActiveLine: true,
});

uBlockDashboard.patchCodeMirrorEditor(cmEditor);

/******************************************************************************/

function getEditorText() {
    const text = cmEditor.getValue().trimEnd();
    return text === '' ? text : `${text}\n`;
}

function setEditorText(text) {
    cmEditor.setValue(`${text.trimEnd()}\n`);
}

/******************************************************************************/

function allowlistChanged() {
    const allowlistElem = qs$('#allowlist');
    const bad = qs$(allowlistElem, '.cm-error') !== null;
    const changedAllowlist = getEditorText().trim();
    const changed = changedAllowlist !== cachedAllowlist;
    qs$('#allowlistApply').disabled = !changed || bad;
    qs$('#allowlistRevert').disabled = !changed;
    CodeMirror.commands.save = changed && !bad ? applyChanges : noopFunc;
}

cmEditor.on('changes', allowlistChanged);

/******************************************************************************/
const buttonUpdateEff = function() {
     // Only update eff list
     // var effEntry = $qs(".listEntry[data-listkey='eff']");
     // effEntry.cl.add('obsolete');
     // effEntry.cl.remove('cached');
     setTimeout(function(){
        messaging.send('dashboard', { what: 'forceUpdateEff' });
     },200);
};

async function renderAllowlist() {
    const details = await messaging.send('dashboard', {
        what: 'getAllowlist',
    });
    qs$('#effListInput').checked = details.dntEnabled; // ADN

    const first = reBadHostname === undefined;
    if ( first ) {
        reBadHostname = new RegExp(details.reBadHostname);
        reHostnameExtractor = new RegExp(details.reHostnameExtractor);
        allowlistDefaultSet = new Set(details.allowlistDefault);
    }
    const toAdd = new Set(allowlistDefaultSet);
    for ( const line of details.allowlist ) {
        const directive = directiveFromLine(line);
        if ( allowlistDefaultSet.has(directive) === false ) { continue; }
        toAdd.delete(directive);
        if ( toAdd.size === 0 ) { break; }
    }
    if ( toAdd.size !== 0 ) {
        details.allowlist.push(...Array.from(toAdd).map(a => `# ${a}`));
    }
    details.allowlist.sort((a, b) => {
        const ad = directiveFromLine(a);
        const bd = directiveFromLine(b);
        const abuiltin = allowlistDefaultSet.has(ad);
        if ( abuiltin !== allowlistDefaultSet.has(bd) ) {
            return abuiltin ? -1 : 1;
        }
        return ad.localeCompare(bd);
    });
    const allowlistStr = details.allowlist.join('\n').trim();
    cachedAllowlist = allowlistStr;
    setEditorText(allowlistStr);
    if ( first ) {
        cmEditor.clearHistory();
    }
}

/******************************************************************************/

function handleImportFilePicker() {
    const file = this.files[0];
    if ( file === undefined || file.name === '' ) { return; }
    if ( file.type.indexOf('text') !== 0 ) { return; }
    const fr = new FileReader();
    fr.onload = ev => {
        if ( ev.type !== 'load' ) { return; }
        const content = uBlockDashboard.mergeNewLines(
            getEditorText().trim(),
            fr.result.trim()
        );
        setEditorText(content);
    };
    fr.readAsText(file);
}

/******************************************************************************/

function startImportFilePicker() {
    const input = qs$('#importFilePicker');
    // Reset to empty string, this will ensure an change event is properly
    // triggered if the user pick a file, even if it is the same as the last
    // one picked.
    input.value = '';
    input.click();
}

/******************************************************************************/

function exportAllowlistToFile() {
    const val = getEditorText();
    if ( val === '' ) { return; }
    const filename =
        i18n$('allowlistExportFilename')
            .replace('{{datetime}}', uBlockDashboard.dateNowToSensibleString())
            .replace(/ +/g, '_');
    vAPI.download({
        'url': `data:text/plain;charset=utf-8,${encodeURIComponent(val + '\n')}`,
        'filename': filename
    });
}

/******************************************************************************/

async function applyChanges() {
    cachedAllowlist = getEditorText().trim();
    await messaging.send('dashboard', {
        what: 'setAllowlist',
        allowlist: cachedAllowlist,
    });
    renderAllowlist();
}

function revertChanges() {
    setEditorText(cachedAllowlist);
}

/******************************************************************************/

function getCloudData() {
    return getEditorText();
}

function setCloudData(data, append) {
    if ( typeof data !== 'string' ) { return; }
    if ( append ) {
        data = uBlockDashboard.mergeNewLines(getEditorText().trim(), data);
    }
    setEditorText(data.trim());
}

self.cloud.onPush = getCloudData;
self.cloud.onPull = setCloudData;

/******************************************************************************/

self.wikilink = 'https://github.com/gorhill/uBlock/wiki/Dashboard:-Trusted-sites';

self.hasUnsavedData = function() {
    return getEditorText().trim() !== cachedAllowlist;
};

/******************************************************************************/

dom.on('#importAllowlistFromFile', 'click', startImportFilePicker);
dom.on('#importFilePicker', 'change', handleImportFilePicker);
dom.on('#exportAllowlistToFile', 'click', exportAllowlistToFile);
dom.on('#allowlistApply', 'click', ( ) => { applyChanges(); });
dom.on('#allowlistRevert', 'click', revertChanges);
dom.on('#buttonUpdateEff', 'click', buttonUpdateEff);

renderAllowlist();

/******************* exports for adn strict-block-list ************************/

export { directiveFromLine, getEditorText, setEditorText, getCloudData, setCloudData, reComment, startImportFilePicker }

/******************************************************************************/
