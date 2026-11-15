# Siki Budget 💶

App privata Android & Web per la gestione di **budget, spese, entrate e conti**, progettata su misura ispirandosi alla disposizione di *"Budget e finanze - spese"* (`ru.innim.my_finance`) con un design moderno, zero pubblicità e sincronizzazione cloud privata.

---

## Caratteristiche principali

- **Dashboard con Grafico ad Anello interattivo**:
  - Switch immediato **`SPESE` | `ENTRATE`**.
  - Periodi **`Giorno` | `Settimana` | `Mese` (dal giorno 1) | `Anno` | `Periodo personalizzato`**.
  - Card categorie ordinate per importo con **percentuale `%`**, **importo in `€`** e **barra del limite mensile** nella vista *Mese*.
  - Drill-down su ogni categoria per consultare **sottocategorie** e singole operazioni.
- **Pulsante `+` rapido con Calcolatrice e Trasferimenti**:
  - **3 tab diretti**: `Spesa` | `Entrata` | `Trasferimento` (tra conti).
  - **Tastierino con calcolatrice integrata** (`+`, `-`, `×`, `÷`, `=`, `,`).
- **Conti & Categorie su misura**:
  - Parte con l'unico conto **`Principale`** e le categorie già allineate al tuo storico **`Budget e finanze`** (con possibilità di aggiungere conti, sottocategorie, riordinarli, escluderli dal saldo totale, rettificare il saldo o archiviarli).
- **Offline-First + Cloud Privato Supabase (`budget-finanze`)**:
  - Salvataggio locale istantaneo (`IndexedDB`) per funzionare sempre anche offline.
  - Sincronizzazione automatica con database PostgreSQL privato protetto da **Row Level Security (RLS)** (con storico 2026 pre-caricato in modo sicuro sul Cloud).
- **Compatibilità 100% con `Budget e finanze.xlsx` (`Spese` / `Entrate` / `Bonifici`)**:
  - Importazione multi-foglio in 1 tocco con filtro anti-duplicati.
  - Esportazione identica a 3 fogli (`Budget e finanze.xlsx`), tabella unica `.xlsx`, `.csv` e backup integrale `.json`.
- **Blocco di sicurezza con PIN a 4 cifre** e **Tema Scuro / Chiaro**.

---

## Come installare `Siki Budget` sul tuo smartphone Android

1. Apri dal browser del tuo telefono la Release aggiornata di questo repository:
   👉 **`https://github.com/Siki32program/Budget-e-finanaze/releases/tag/latest-apk`**
2. Tocca il file **`Siki-Budget.apk`** per scaricarlo.
3. Apri il file scaricato e premi **Installa** (se Android chiede il permesso per installare da Chrome, consenti una sola volta).
4. Apri **Siki Budget → Impostazioni → Cloud Privato Supabase → Primo Accesso (Crea)** con la tua email Google per sincronizzare istantaneamente tutto lo storico 2026.

---

## Sviluppo locale

```bash
npm install
npm run dev
```

Per sincronizzare le modifiche con il progetto nativo Android:

```bash
npm run android:sync
```
