// ===============================================================
// Code.gs - Gestione Letture Contatori (Versione Pulita Finale)
// Ripristinata risposta completa, Corretti Nomi Colonne.
// ===============================================================

// --- CONFIGURAZIONE PRINCIPALE ---
// ASSICURATI CHE QUESTI VALORI SIANO ESATTI!
const CONFIG = {
  SPREADSHEET_ID: '1GKqcZWPSi7mq7s8Ht-IRwCK641p82xoIplMwixIxfFw', // VERIFICA QUESTO ID!
  SHEETS: {
    LETTURE: 'Letture',         // Verifica nome esatto foglio
    APPARTAMENTI: 'Appartamenti', // Verifica nome esatto foglio
    CONDOMINI: 'Condomini'      // Verifica nome esatto foglio
  }
};

// --- FUNZIONE PRINCIPALE PER IL FRONTEND ---
function doGet(e) {
  Logger.log("doGet: Richiesta ricevuta.");
  try {
    // Assicurati che il file HTML si chiami 'ViewLetture.html' nelllo stesso progetto Apps Script
    return HtmlService.createTemplateFromFile('ViewLetture')
      .evaluate()
      .setTitle('Gestione Letture Contatori')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
     Logger.log("ERRORE CRITICO in doGet: Non è stato possibile caricare 'ViewLetture.html'. Verifica che il file esista. Errore: " + error);
     // Restituisce un messaggio semplice in caso di errore grave nel caricamento dell'HTML
     return HtmlService.createHtmlOutput("<html><body><h1>Errore caricamento applicazione</h1><p>Impossibile caricare il file HTML principale. Controllare i log del server.</p></body></html>");
  }
}

// --- FUNZIONE UNIFICATA PER CARICARE DATI INIZIALI ---
// Chiamata dal frontend all'avvio
function getInitialData() {
  Logger.log("getInitialData: Inizio recupero dati iniziali...");
  const startTime = new Date();
  let ss; // Definisci ss qui per usarlo nel blocco finally se necessario
  try {
    // Apri lo Spreadsheet una sola volta
    ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    Logger.log("Spreadsheet aperto: ID " + CONFIG.SPREADSHEET_ID);

    // Recupera tutti i dati necessari
    const apartmentsResult = getApartmentsInternal(ss);
    const condominiumsResult = getCondominiumsInternal(ss);
    let lettureResult;

    // Leggi le letture solo se appartamenti e condomini sono stati letti con successo
    if (apartmentsResult.success && condominiumsResult.success) {
       lettureResult = getLettureInternal(ss, apartmentsResult.apartments); // Passa i dati appartamenti
    } else {
       lettureResult = { success: false, letture: [], error: "Lettura appartamenti/condomini fallita, impossibile procedere con letture." };
       Logger.log("WARN: " + lettureResult.error);
    }

    const endTime = new Date();
    Logger.log("Dati recuperati in %s ms. Appartamenti: %s, Condomini: %s, Letture: %s",
               endTime.getTime() - startTime.getTime(),
               apartmentsResult.apartments ? apartmentsResult.apartments.length : 'Errore (' + apartmentsResult.error + ')',
               condominiumsResult.condominiums ? condominiumsResult.condominiums.length : 'Errore (' + condominiumsResult.error + ')',
               lettureResult.letture ? lettureResult.letture.length : 'Errore (' + lettureResult.error + ')');

    // Costruisci l'oggetto di risposta FINALE
    const response = {
      success: apartmentsResult.success && condominiumsResult.success && lettureResult.success,
      apartments: apartmentsResult.apartments || [],
      condominiums: condominiumsResult.condominiums || [],
      letture: lettureResult.letture || [],
      error: [apartmentsResult.error, condominiumsResult.error, lettureResult.error].filter(e => e).join('; ') || null
    };

    Logger.log("getInitialData: Dati inviati al frontend (Successo: %s).", response.success);
    // ---> RESTITUISCE L'OGGETTO COMPLETO <---
    return response;

  } catch (error) {
    Logger.log("ERRORE GRAVE in getInitialData: " + error.message + "\nStack: " + error.stack);
    return {
      success: false, letture: [], apartments: [], condominiums: [],
      error: "Errore generale nel caricamento dei dati dal server: " + error.message
    };
  }
}


// --- FUNZIONI INTERNE PER RECUPERO DATI ---

/**
 * Legge i dati dal foglio Appartamenti, usando 'Numero/interno'.
 */
function getApartmentsInternal(ss) {
   const sheetName = CONFIG.SHEETS.APPARTAMENTI;
   Logger.log("getApartmentsInternal: Lettura foglio '%s'...", sheetName);
   try {
     const sheet = ss.getSheetByName(sheetName);
     if (!sheet) return { success: false, apartments: [], error: `Foglio ${sheetName} non trovato.` };
     const data = sheet.getDataRange().getValues();
     if (data.length <= 1) return { success: true, apartments: [], error: null };

     const headers = data[0].map(h => String(h || '').trim());
     const colMap = {}; headers.forEach((h, i) => { if (h) colMap[h] = i; });

     // --- COLONNA CORRETTA CON 'i' MINUSCOLA ---
     const nomeColonnaNumero = 'Numero/interno';
     const requiredCols = ['ID', 'Condominio ID', nomeColonnaNumero, 'Proprietario'];

     for (const col of requiredCols) {
         if (colMap[col] === undefined) {
              const errorMsg = `Colonna obbligatoria mancante: '${col}' nel foglio '${sheetName}'`;
              Logger.log("ERRORE: " + errorMsg);
              return { success: false, apartments: [], error: errorMsg };
         }
     }

     const apartments = [];
     for (let i = 1; i < data.length; i++) {
       const row = data[i]; const id = String(row[colMap['ID']] || ''); if (!id) continue;
       try {
           apartments.push({
             id: id, condominiumId: String(row[colMap['Condominio ID']] || ''),
             number: String(row[colMap[nomeColonnaNumero]] || ''), // CORRETTO
             owner: String(row[colMap['Proprietario']] || ''),
             floor: String(row[colMap['Piano']] || ''), email: String(row[colMap['Email']] || ''),
           });
        } catch (rowError) { Logger.log("Errore riga %s foglio '%s': %s", i + 1, sheetName, rowError.message); }
     }
     Logger.log("getApartmentsInternal: Elaborati %s appartamenti.", apartments.length);
     return { success: true, apartments: apartments, error: null };
   } catch (error) {
     Logger.log("ERRORE grave in getApartmentsInternal: " + error.message);
     return { success: false, apartments: [], error: `Errore lettura Foglio ${sheetName}: ${error.message}` };
   }
}

/**
 * Legge i dati dal foglio Condomini, usando 'Nome'.
 */
function getCondominiumsInternal(ss) {
  const sheetName = CONFIG.SHEETS.CONDOMINI;
  Logger.log("getCondominiumsInternal: Lettura foglio '%s'...", sheetName);
  try {
    const sheet = ss.getSheetByName(sheetName);
     if (!sheet) return { success: false, condominiums: [], error: `Foglio ${sheetName} non trovato.` };
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, condominiums: [], error: null };
     const headers = data[0].map(h => String(h || '').trim());
     const colMap = {}; headers.forEach((h, i) => { if (h) colMap[h] = i; });

     // --- COLONNA CORRETTA ---
     const nomeColonnaNomeCondominio = 'Nome';
     const requiredCols = ['ID', nomeColonnaNomeCondominio];

     for (const col of requiredCols) {
         if (colMap[col] === undefined) {
              const errorMsg = `Colonna obbligatoria mancante: '${col}' nel foglio '${sheetName}'`;
              Logger.log("ERRORE: " + errorMsg);
              return { success: false, condominiums: [], error: errorMsg };
         }
     }

    const condominiums = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i]; const id = String(row[colMap['ID']] || ''); if (!id) continue;
      try {
          condominiums.push({
            id: id, name: String(row[colMap[nomeColonnaNomeCondominio]] || ''), // CORRETTO
            address: String(row[colMap['Indirizzo']] || ''),
          });
      } catch (rowError) { Logger.log("Errore riga %s foglio '%s': %s", i + 1, sheetName, rowError.message); }
    }
     Logger.log("getCondominiumsInternal: Elaborati %s condomini.", condominiums.length);
     return { success: true, condominiums: condominiums, error: null };
  } catch (error) {
     Logger.log("ERRORE grave in getCondominiumsInternal: " + error.message);
     return { success: false, condominiums: [], error: `Errore lettura Foglio ${sheetName}: ${error.message}` };
  }
}

/**
 * Legge i dati dal foglio Letture, usando 'Tipo Contatore'.
 */
function getLettureInternal(ss, apartmentsData) {
  const sheetName = CONFIG.SHEETS.LETTURE;
  Logger.log("getLettureInternal: Lettura foglio '%s'...", sheetName);
  try {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) { /* ... crea foglio ... */
        Logger.log("Foglio '%s' non trovato, creazione...", sheetName);
        const newSheet = ss.insertSheet(sheetName);
        newSheet.appendRow(['ID', 'Appartamento ID', 'Tipo Contatore', 'Data Lettura', 'Valore', 'Consumo', 'Metodo', 'Immagine URL', 'Note', 'Data Creazione']);
        return { success: true, letture: [], error: null };
    }
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, letture: [], error: null };

    const headers = data[0].map(h => String(h || '').trim());
    const colMap = {}; headers.forEach((h, i) => { if (h) colMap[h] = i; });
    // --- COLONNA CORRETTA ---
    const nomeColonnaTipo = 'Tipo Contatore';
    const requiredCols = ['ID', 'Appartamento ID', nomeColonnaTipo, 'Data Lettura', 'Valore'];
    for (const col of requiredCols) {
        if (colMap[col] === undefined) { return { success: false, letture: [], error: `Colonna mancante: '${col}' nel foglio '${sheetName}'` }; }
    }

    const letture = [];
    const aptCondoMap = {};
    (apartmentsData || []).forEach(apt => aptCondoMap[apt.id] = apt.condominiumId);

    for (let i = 1; i < data.length; i++) {
      const row = data[i]; const id = String(row[colMap['ID']] || ''); if (!id) continue;
      try {
         const appartamentoId = String(row[colMap['Appartamento ID']] || '');
         const tipoContatore = String(row[colMap[nomeColonnaTipo]] || '').toLowerCase(); // CORRETTO
         const dataLettura = safeParseDate(row[colMap['Data Lettura']]);
         const valoreLettura = safeParseFloat(row[colMap['Valore']], 0);
         const condominioId = aptCondoMap[appartamentoId] || "sconosciuto";
         const letturaPrecObj = getUltimaLetturaPrecedente(ss, appartamentoId, tipoContatore, dataLettura);
         const letturaPrecedente = letturaPrecObj ? letturaPrecObj.lettura : 0;
         const consumo = valoreLettura - letturaPrecedente;
         letture.push({
            id: id, appartamentoId: appartamentoId, condominioId: condominioId,
            tipoContatore: tipoContatore, data: dataLettura ? dataLettura.toISOString() : null,
            lettura: valoreLettura, letturaPrecedente: letturaPrecedente, consumo: consumo,
            metodo: String(row[colMap['Metodo']] || 'manuale'),
            immagineUrl: String(row[colMap['Immagine URL']] || ''),
            note: String(row[colMap['Note']] || ''),
            dataCreazione: safeParseDate(row[colMap['Data Creazione']])?.toISOString() || null
          });
      } catch(rowError) { Logger.log("Errore riga %s foglio '%s': %s", i + 1, sheetName, rowError.message); }
     }

    letture.sort((a, b) => (b.data && a.data) ? new Date(b.data) - new Date(a.data) : 0);
    Logger.log("getLettureInternal: Elaborate %s letture.", letture.length);
    return { success: true, letture: letture, error: null };
  } catch (error) {
    Logger.log("ERRORE grave in getLettureInternal: " + error.message);
    return { success: false, letture: [], error: `Errore lettura Foglio ${sheetName}: ${error.message}` };
  }
}


// --- FUNZIONE PER AGGIUNGERE UNA LETTURA ---
function addLettura(formData) {
  Logger.log("addLettura: Ricevuti dati: %s", JSON.stringify(formData));
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(CONFIG.SHEETS.LETTURE);
    if (!sheet) { /* ... crea foglio con intestazioni corrette ... */
       Logger.log("Foglio '%s' non trovato, creazione...", CONFIG.SHEETS.LETTURE);
       sheet = ss.insertSheet(CONFIG.SHEETS.LETTURE);
       sheet.appendRow(['ID', 'Appartamento ID', 'Tipo Contatore', 'Data Lettura', 'Valore', 'Consumo', 'Metodo', 'Immagine URL', 'Note', 'Data Creazione']); // Assicurati ordine colonne
    }

    if (!formData || !formData.appartamentoId || !formData.tipoContatore || !formData.data || formData.lettura === undefined || formData.lettura === null) { throw new Error("Dati form mancanti/incompleti."); }
    const id = Utilities.getUuid(); const now = new Date();
    const dataLettura = safeParseDate(formData.data); if (!dataLettura) throw new Error("Data lettura non valida.");
    const valoreLettura = safeParseFloat(formData.lettura);
    const tipoContatore = String(formData.tipoContatore).toLowerCase();
    const appartamentoId = String(formData.appartamentoId);

    const ultimaLetturaPrec = getUltimaLetturaPrecedente(ss, appartamentoId, tipoContatore, dataLettura);
    const letturaPrecedente = ultimaLetturaPrec ? ultimaLetturaPrec.lettura : 0;
    const consumo = valoreLettura - letturaPrecedente;
    const metodo = formData.immagine ? 'scansione' : 'manuale';
    let immagineUrl = ''; if (metodo === 'scansione' && formData.immagine) { immagineUrl = salvaImmagine(formData.immagine, id); }

    const newRow = [ id, appartamentoId, tipoContatore, dataLettura, valoreLettura, consumo, metodo, immagineUrl, formData.note || '', now ];
    sheet.appendRow(newRow);
    Logger.log("addLettura: Riga aggiunta ID: %s", id);
    return { success: true, id: id, consumo: consumo, message: "Lettura registrata." };
  } catch (error) {
    Logger.log("ERRORE in addLettura: " + error.message);
    return { success: false, error: "Errore registrazione lettura: " + error.message };
  }
}


// --- FUNZIONI PER RECUPERARE LETTURE SPECIFICHE (Ultima, Precedente) ---
// Queste funzioni richiedono di leggere i dati, assicurati che usino i nomi colonna corretti internamente se necessario
function getUltimaLetturaPrecedente(ss, apartmentId, tipoContatore, dataAttuale) {
   const sheetName = CONFIG.SHEETS.LETTURE;
   /* ... Logica come prima, verifica uso di colMap['Tipo Contatore'] etc. ... */
    Logger.log("getUltimaLetturaPrecedente: AptID %s, Tipo %s, Prima di %s", apartmentId, tipoContatore, dataAttuale ? dataAttuale.toISOString() : 'N/D');
   try {
     const sheet = ss.getSheetByName(sheetName); if (!sheet || !dataAttuale) return null;
     const data = sheet.getDataRange().getValues(); if (data.length <= 1) return null;
     const headers = data[0].map(h => String(h || '').trim()); const colMap = {}; headers.forEach((h, i) => { if (h) colMap[h] = i; });
     const nomeColonnaTipo = 'Tipo Contatore'; const required = ['Appartamento ID', nomeColonnaTipo, 'Data Lettura', 'Valore'];
     for (const col of required) { if (colMap[col] === undefined) { Logger.log("WARN: Colonna mancante '%s' in getUltimaLetturaPrecedente.", col); return null; } }
     let ultimaPrecedente = null; let dataUltimaPrec = new Date(0);
     for (let i = 1; i < data.length; i++) {
         const row = data[i]; const aptIdRow = String(row[colMap['Appartamento ID']] || '');
         const tipoRow = String(row[colMap[nomeColonnaTipo]] || '').toLowerCase();
         const dataRow = safeParseDate(row[colMap['Data Lettura']]);
         if (aptIdRow === apartmentId && tipoRow === tipoContatore && dataRow && dataRow < dataAttuale) {
             if (dataRow > dataUltimaPrec) {
                 dataUltimaPrec = dataRow; ultimaPrecedente = { id: String(row[colMap['ID']] || ''), data: dataRow, lettura: safeParseFloat(row[colMap['Valore']], 0) };
             } } }
     Logger.log("getUltimaLetturaPrecedente: Trovata: %s", ultimaPrecedente ? 'Sì' : 'No'); return ultimaPrecedente;
   } catch (error) { Logger.log("ERRORE in getUltimaLetturaPrecedente: " + error.message); return null; }
}

function getUltimaLettura(apartmentId, tipoContatore) {
   const sheetName = CONFIG.SHEETS.LETTURE;
    /* ... Logica come prima, verifica uso di colMap['Tipo Contatore'] etc. ... */
   Logger.log("getUltimaLettura: AptID %s, Tipo %s", apartmentId, tipoContatore);
   try {
     const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); const sheet = ss.getSheetByName(sheetName); if (!sheet) return null;
     const data = sheet.getDataRange().getValues(); if (data.length <= 1) return null;
     const headers = data[0].map(h => String(h || '').trim()); const colMap = {}; headers.forEach((h, i) => { if (h) colMap[h] = i; });
     const nomeColonnaTipo = 'Tipo Contatore'; const required = ['Appartamento ID', nomeColonnaTipo, 'Data Lettura', 'Valore'];
     for (const col of required) { if (colMap[col] === undefined) { Logger.log("WARN: Colonna mancante '%s' in getUltimaLettura.", col); return null; } }
     let ultimaLettura = null; let dataUltima = new Date(0);
     for (let i = 1; i < data.length; i++) {
         const row = data[i]; const aptIdRow = String(row[colMap['Appartamento ID']] || '');
         const tipoRow = String(row[colMap[nomeColonnaTipo]] || '').toLowerCase();
         const dataRow = safeParseDate(row[colMap['Data Lettura']]);
         if (aptIdRow === apartmentId && tipoRow === tipoContatore && dataRow) {
             if (dataRow >= dataUltima) {
                 dataUltima = dataRow; ultimaLettura = { id: String(row[colMap['ID']] || ''), data: dataRow.toISOString(), lettura: safeParseFloat(row[colMap['Valore']], 0) };
             } } }
     Logger.log("getUltimaLettura: Trovata: %s", ultimaLettura ? 'Sì' : 'No'); return ultimaLettura;
   } catch (error) { Logger.log("ERRORE in getUltimaLettura: " + error.message); return null; }
}


// --- FUNZIONE HELPER PER SALVARE IMMAGINE ---
function salvaImmagine(base64Data, letturaId) {
  try {
    Logger.log("salvaImmagine: Tentativo per lettura ID %s", letturaId);
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) { Logger.log("Formato base64 non valido."); return ''; }
    const contentType = matches[1]; const base64EncodedData = matches[2];
    const blob = Utilities.newBlob(Utilities.base64Decode(base64EncodedData), contentType, 'lettura_' + letturaId + '.jpg');
    let folder; const folderName = 'Letture Contatori Immagini';
    const folderIterator = DriveApp.getFoldersByName(folderName);
    folder = folderIterator.hasNext() ? folderIterator.next() : DriveApp.createFolder(folderName);
    const file = folder.createFile(blob); const fileUrl = file.getUrl();
    Logger.log("Immagine salvata: %s", fileUrl); return fileUrl;
  } catch (error) { Logger.log("ERRORE in salvaImmagine: " + error.message); return ''; }
}


// --- FUNZIONI HELPER PER PARSING SICURO ---
function safeParseDate(dateValue) {
   if (!dateValue) return null;
   if (dateValue instanceof Date && !isNaN(dateValue.getTime())) return dateValue;
   try {
     const parsedDate = new Date(dateValue);
     return isNaN(parsedDate.getTime()) ? null : parsedDate;
   } catch (e) { Logger.log("safeParseDate: Errore parsing '%s': %s", dateValue, e.message); return null; }
}
function safeParseFloat(value, defaultValue = 0) {
   if (value === null || value === undefined || value === '') return defaultValue;
   const cleanedValue = String(value).replace(',', '.').replace(/[^\d.-]/g, '');
   const parsed = parseFloat(cleanedValue); return isNaN(parsed) ? defaultValue : parsed;
}

// --- FUNZIONI PER INCLUSIONE E DEBUG ---
function include(filename) {
  try { Logger.log("Include: Tentativo caricamento '%s.html'", filename);
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (error) { Logger.log("ERRORE in include() per file '%s': %s", filename, error.message);
    return `<!-- Errore inclusione file: ${filename}.html -->`; }
}
// Funzione per includere JS specifico per modali (se necessario)
function includeJsModal() {
  return `<script> console.log("Script Modale Incluso (se necessario)."); </script>`;
}
// Funzioni di Debug
function testDebug() { Logger.log("Test Debug Eseguito."); return { status: "OK", message: "Funzione debug eseguita."}; }
function testBasicAccess() {
   try { const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); const sheet = ss.getSheetByName(CONFIG.SHEETS.LETTURE);
     const name = sheet ? sheet.getName() : 'Foglio non trovato'; Logger.log("Test Accesso: Foglio Letture trovato: " + (sheet ? 'Sì' : 'No')); return { success: true, sheetName: name };
   } catch (e) { Logger.log("Test Accesso Fallito: " + e.message); return { success: false, error: e.message }; }
}
