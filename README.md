SHIFTER— Specifica del progetto
Versione 1.1 — 16 ottobre 2026
Stato: requisiti iniziali definiti, sviluppo non ancora iniziato.
1. Obiettivo
Creare una web app personale, utilizzabile da smartphone e PC, per compilare il programmato mensile dei turni di lavoro, sincronizzarlo con Google Calendar e generare un documento Word da inviare al lavoro.
L'app deve essere semplice, veloce e utilizzabile privatamente, senza pubblicazione sugli store.
2. Architettura e vincoli
	• Preferenza per una PWA, installabile sul telefono.
	• Nessun backend applicativo e nessun database, se tecnicamente possibile.
	• Elaborazione dei dati nel browser.
	• Google Calendar come fonte dei programmati già salvati.
	• Backup JSON scaricabile per conservare e ripristinare tutti i dati.
	• Generazione Word direttamente nel browser.
	• OCR nel browser per creare il programmato da una fotografia.
	• Hosting previsto sul server Linux domestico tramite Docker, con accesso privato attraverso Tailscale.
	• Autenticazione e autorizzazione tramite Google. È accettabile dover autorizzare nuovamente l'accesso quando necessario.
	• Tecnologie inizialmente ipotizzate: HTML, CSS, TypeScript e Vite, senza obbligo di utilizzare React.
I dati non ancora salvati nel calendario o in un backup possono andare persi chiudendo la pagina.
3. Menu principale
Dopo aver effettuato l'accesso con Google, mostrare queste cinque funzioni:
	1. Crea programmato da foto
	2. Crea programmato a mano
	3. Importa programmato da backup
	4. Esporta programmato come backup
	5. Export programmato da inviare (Word)
4. Turni e giustificativi
Non esiste una distinzione funzionale tra turno singolo e doppio. Esistono turni con orari definiti, eventualmente organizzati in due gruppi visivi: giorno e notte.
Turni iniziali
Giorno
	• 06–12
	• 07–15
	• 12–18
	• 13–19
	• 15–23
	• 18–00
Notte
	• 23–07
	• 00–06
L'elenco dei giustificativi deve essere definito prima dello sviluppo della procedura guidata.
Inserimento manuale
	• L'utente seleziona il mese.
	• La procedura mostra un giorno alla volta, la data e l'avanzamento.
	• I turni sono presentati in gruppi giorno/notte e i giustificativi in una riga separata.
	• Selezionando un turno o un giustificativo, il dato viene registrato e si passa al giorno successivo, senza conferme superflue.
	• Le date di riferimento dei turni notturni devono rispettare la convenzione del programmato, che va chiarita prima dell'implementazione.
5. Schermata finale di revisione
È il punto centrale dell'applicazione. Deve mostrare il programmato completo del mese, con date, turni, giustificativi e note.
L'utente deve poter:
	• Toccare un orario per modificare il turno.
	• Modificare o sostituire un giustificativo.
	• Visualizzare, inserire, modificare e cancellare le note.
	• Correggere eventuali errori dell'OCR.
	• Verificare il risultato prima di salvarlo o esportarlo.
Le note di un evento Google Calendar corrispondono al campo descrizione. Devono essere recuperate, mantenute se non modificate e riscritte nel calendario quando l'utente salva le modifiche.
Dalla revisione devono essere disponibili le operazioni pertinenti: salvataggio su Google Calendar, esportazione JSON e generazione Word.
6. Google Calendar
L'app deve funzionare nel calendario Google abituale, anche se contiene eventi personali e altri appuntamenti. Non è obbligatorio utilizzare un calendario separato per i turni.
Gli eventi creati dall'app devono essere riconoscibili in modo affidabile tramite metadati applicativi e identificativi Google Calendar.
I turni già inseriti manualmente dovranno essere riconosciuti attraverso regole da definire. L'orario di inizio e fine è un indizio utile, ma non basta da solo a distinguere con certezza un turno da un evento personale.
Regole di sicurezza:
	• Non modificare o cancellare eventi personali.
	• Non sovrascrivere eventi ambigui.
	• Evitare duplicati quando si aggiornano turni già presenti.
	• Mostrare e verificare le modifiche prima di applicarle.
	• Gestire i turni notturni e quelli a cavallo tra due mesi.
	• Non dichiarare un salvataggio riuscito se Google Calendar restituisce un errore.
7. Creazione da foto
L'app analizza una fotografia del programmato tramite OCR, prova a riconoscere date, turni e giustificativi e porta direttamente alla schermata finale di revisione.
Il riconoscimento può sbagliare: tutti i dati devono essere correggibili. L'OCR non deve obbligare l'utente a utilizzare un flusso separato di conferma prima della revisione.
8. Backup JSON
L'esportazione richiede la selezione del mese, recupera i turni pertinenti da Google Calendar e scarica un file JSON.
Il backup deve contenere tutto ciò che serve a ricostruire il programmato: mese, date, turni, orari effettivi, giustificativi, note e identificativi disponibili. Il formato deve essere versionato.
L'importazione legge il JSON, verifica che sia valido, ricostruisce il programmato e lo apre nella schermata finale. Non deve modificare automaticamente Google Calendar: il ripristino in memoria e il salvataggio nel calendario sono operazioni distinte.
9. Esportazione Word
Il flusso deve essere:
	1. Selezione del mese.
	2. Recupero dei dati pertinenti da Google Calendar.
	3. Apertura della schermata finale di revisione.
	4. Correzione dei dati, se necessario.
	5. Generazione e download del documento Word.
Il documento deve includere le informazioni previste per il programmato. Layout, intestazioni e possibile utilizzo di un modello Word dell'ufficio saranno definiti successivamente. Le note devono essere disponibili anche per l'esportazione.
10. Scaletta di sviluppo per priorità
L'ordine seguente considera sia l'importanza delle funzionalità sia le dipendenze tecniche.
Fase 1 — Definizione delle regole
	• Confermare la convenzione delle date per i turni notturni.
	• Definire i giustificativi.
	• Definire la struttura dei dati.
	• Stabilire come riconoscere i turni già presenti nel calendario.
	• Stabilire come trattare conflitti, duplicati e modifiche.
Fase 2 — Prototipo dell'interfaccia
	• Creare il menu principale.
	• Realizzare la procedura guidata manuale.
	• Realizzare la schermata finale di revisione.
	• Consentire modifica dei turni, giustificativi e note.
	• Verificare l'usabilità da smartphone e PC con dati di prova.
Fase 3 — Integrazione Google Calendar
	• Configurare Google Cloud, Calendar API e OAuth.
	• Leggere gli eventi di un mese.
	• Riconoscere gli eventi pertinenti.
	• Creare e aggiornare eventi, preservando le note.
	• Prevenire duplicazioni e proteggere gli eventi personali.
Fase 4 — Backup e ripristino
	• Definire il formato JSON versionato.
	• Esportare il programmato completo dal calendario.
	• Importare un backup nella revisione.
	• Testare il ripristino senza modificare subito Google Calendar.
Fase 5 — Documento Word
	• Definire il layout.
	• Generare il documento dal programmato revisionato.
	• Verificare turni, giustificativi e note.
	• Valutare un eventuale modello Word fornito dall'ufficio.
Fase 6 — Riconoscimento da foto
	• Integrare l'OCR.
	• Interpretare date, turni e giustificativi.
	• Gestire i riconoscimenti incerti.
	• Verificare che ogni errore possa essere corretto nella revisione.
Fase 7 — Installazione e collaudo
	• Configurare la PWA.
	• Pubblicare i file statici sul server Linux.
	• Configurare l'accesso privato tramite Tailscale e HTTPS.
	• Testare accesso Google, scadenza dei token, salvataggio, backup, Word e uso mobile.
11. Criteri di completamento
Il progetto sarà considerato utilizzabile quando sarà possibile:
	• Accedere con Google.
	• Compilare un mese manualmente.
	• Recuperare un mese da Google Calendar.
	• Modificare turni, giustificativi e note.
	• Salvare senza duplicare eventi né modificare quelli personali.
	• Esportare e importare un backup completo.
	• Generare un Word dopo la revisione.
	• Creare un programmato da fotografia e correggere gli errori.
	• Usare l'app privatamente da smartphone e PC.
12. Decisioni ancora aperte
Prima di implementare le parti interessate occorre definire:
	• Elenco e significato dei giustificativi.
	• Convenzione delle date dei turni notturni.
	• Gestione dei turni a cavallo tra mesi.
	• Regole di riconoscimento degli eventi già esistenti.
	• Gestione delle modifiche contemporanee tra app e Google Calendar.
	• Layout Word e possibile modello ufficiale.
	• Dettagli definitivi di hosting, HTTPS e autorizzazione Google.
Indicazione per una nuova chat: usare questo documento come fonte primaria dei requisiti. Non ricominciare la progettazione da zero e non introdurre nuove categorie di turno o funzionalità senza verificarle con l'utente. Prima di scrivere il codice definitivo, risolvere le decisioni ancora aperte e procedere una fase alla volta.










SHIFTER — Fase 1: regole, dati, schema
Versione 1.2 — 16 ottobre 2026 Integra la specifica v1.1. Stato: regole fissate, in attesa di approvazione per passare alla Fase 2.
1. Periodo del programmato
	• Il programmato di un mese inizia il primo lunedì che cade in quel mese.
	• Finisce la domenica prima del primo lunedì del mese successivo.
	• Dura 4 o 5 settimane intere (lunedì–domenica). Ogni settimana appartiene a un solo programmato.
	• Data di inizio e di fine sono modificabili a mano (eventuali eccezioni dell'ufficio).
	Programmato	Inizio	Fine	Settimane
	Settembre 2026	07/09	04/10	4
	Ottobre 2026	05/10	01/11	4
	Novembre 2026	02/11	06/12	5
L'app lavora su un intervallo di date, non su un mese di calendario.
2. Giorni, turni e giustificativi
	• Ogni giorno ha una sola voce: un turno, un giustificativo, oppure vuoto.
	• Fuso orario: Europe/Rome, anche a cavallo della mezzanotte e del cambio ora legale.
	• La colonna di un giorno D è il giorno in cui il turno finisce. Eccezione: il 18–00, turno diurno, resta nella colonna del giorno in cui inizia.
	• Nel calendario Google gli eventi hanno sempre le date reali.
Catalogo turni (iniziale, nessun'altra categoria senza conferma)
Codice	Gruppo	Inizio	Fine	Titolo evento
06-12	giorno	D 06:00	D 12:00	Turno 06-12
07-15	giorno	D 07:00	D 15:00	Turno 07-15
12-18	giorno	D 12:00	D 18:00	Turno 12-18
13-19	giorno	D 13:00	D 19:00	Turno 13-19
15-23	giorno	D 15:00	D 23:00	Turno 15-23
18-00	giorno	D 18:00	D+1 00:00	Turno 18-00
23-07	notte	D-1 23:00	D 07:00	Turno 23-07
00-06	notte	D 00:00	D 06:00	Turno 00-06
Esempio: 16/10 = 07-15 e 17/10 = 23-07 significa evento dal 16 alle 07:00 alle 15:00, ed evento dal 16 alle 23:00 al 17 alle 07:00.
Giustificativi
	• Codici: CO, FS, ROL, RS.
	• Eventi a giornata intera, titolo uguale al codice, esclusivi rispetto al turno dello stesso giorno.
	• I significati servono solo per la legenda del Word (Fase 5).
Avvisi in revisione (non bloccanti)
	• Se il giorno D ha 18-00 e il giorno D+1 ha 23-07, i due eventi si sovrappongono 23:00–00:00.
3. Wizard manuale
	• Una lista unica per giorno: turni giorno, turni notte, giustificativi.
	• Un tocco registra la scelta e passa al giorno dopo, senza conferme.
	• Mostra data e avanzamento. Si può tornare indietro e lasciare un giorno vuoto.
4. Google Calendar
	• Calendario principale dell'account. Scope iniziale: calendar.events, estendibile.
	• Lo strato calendario è separato dal resto (interfaccia CalendarProvider) per poter aggiungere Outlook in futuro.
Riconoscimento eventi
	• Ogni evento creato dall'app porta extendedProperties.private: 
		○ turniApp = "turni-calendar"
		○ turniSchema = "1"
		○ turniDay = "YYYY-MM-DD" (la colonna del programmato)
		○ turniKind = "shift" | "leave"
		○ turniCode = "07-15" | "CO" | ...
	• Qualunque evento senza marcatore è intoccabile: non si modifica, non si cancella, non si sovrascrive.
	• Non servono regole di riconoscimento a posteriori (il calendario è vuoto).
Lettura di un intervallo
	• Si leggono gli eventi marcati da (inizio − 1 giorno) a (fine + 1 giorno), perché un 23-07 della prima colonna parte la domenica prima, e un 18-00 dell'ultima domenica finisce il lunedì dopo.
	• Ogni evento viene assegnato alla colonna indicata da turniDay.
Salvataggio
	1. Si confronta lo stato dell'app con quello su Google, solo sugli eventi marcati.
	2. Si mostra l'elenco delle modifiche (crea / aggiorna / elimina) e si chiede conferma.
	3. Si applicano: un giorno ha al massimo un evento marcato, quindi niente duplicati; si aggiorna l'evento esistente invece di crearne un altro.
	4. Un evento marcato viene eliminato solo se l'utente svuota quel giorno.
	5. Le note (campo description) vengono lette, mantenute se non modificate, riscritte al salvataggio.
	6. Se Google restituisce un errore, non si dichiara il successo: si mostra quale giorno è fallito e si può riprovare.
Modifiche concorrenti
	• All'apertura si memorizzano etag e updated di ogni evento.
	• Al salvataggio, se un evento marcato è cambiato su Google nel frattempo, l'app mostra la differenza e chiede cosa fare (tieni la mia versione / tieni quella di Google). Non si sovrascrive in silenzio.
5. Struttura dati
ts
type Entry =
  | { type: "shift"; code: ShiftCode; start: string; end: string }  // ISO locale con offset
  | { type: "leave"; code: "CO" | "FS" | "ROL" | "RS" }
  | null;
type ShiftCode = "06-12" | "07-15" | "12-18" | "13-19" | "15-23" | "18-00" | "23-07" | "00-06";
interface Day {
  date: string;            // "YYYY-MM-DD", colonna del programmato
  entry: Entry;
  note: string;            // = description dell'evento
  calendarRef?: { provider: "google"; eventId: string; etag?: string; updated?: string };
}
interface Schedule {
  formatVersion: 1;
  app: "turni-calendar";
  exportedAt: string;
  timezone: "Europe/Rome";
  period: { label: string; start: string; end: string };  // label "2026-10"
  days: Day[];             // uno per ogni data dell'intervallo
}
6. Backup JSON versionato (v1)
json
{
  "formatVersion": 1,
  "app": "turni-calendar",
  "exportedAt": "2026-10-16T12:00:00+02:00",
  "timezone": "Europe/Rome",
  "period": { "label": "2026-10", "start": "2026-10-05", "end": "2026-11-01" },
  "days": [
    {
      "date": "2026-10-16",
      "entry": { "type": "shift", "code": "07-15",
                 "start": "2026-10-16T07:00:00+02:00", "end": "2026-10-16T15:00:00+02:00" },
      "note": "",
      "calendarRef": { "provider": "google", "eventId": "abc123", "etag": "\"3\"", "updated": "2026-10-10T08:00:00Z" }
    },
    {
      "date": "2026-10-17",
      "entry": { "type": "shift", "code": "23-07",
                 "start": "2026-10-16T23:00:00+02:00", "end": "2026-10-17T07:00:00+02:00" },
      "note": "Cambio con collega",
      "calendarRef": null
    },
    { "date": "2026-10-18", "entry": { "type": "leave", "code": "RS" }, "note": "" }
  ]
}
Regole di importazione
	• Si verifica app, formatVersion (versione sconosciuta = rifiuto con messaggio chiaro), copertura delle date e coerenza di codici e orari col catalogo.
	• Si apre la revisione senza toccare Google Calendar. Il salvataggio è un'operazione separata.
	• I calendarRef importati sono solo indizi: al salvataggio si ricontrolla su Google tramite turniDay.
7. Rimandato
	• Significati di CO, FS, ROL, RS (Fase 5, legenda Word).
	• Layout Word e possibile modello ufficiale; se il Word deve mostrare solo la tua riga o anche quelle dei colleghi (Fase 5).
	• OCR, considerato un bonus: la foto è scattata attraverso un vetro (Fase 6).
	• Dettagli di HTTPS, Tailscale (già attivo) e client OAuth (Fasi 3 e 7).
8. Prossimo passo
Dopo la tua approvazione: Fase 2 — prototipo dell'interfaccia (menu, wizard manuale, revisione) con dati di prova e senza Google, in HTML/CSS/TypeScript con Vite.

![Uploading image.png…]()
