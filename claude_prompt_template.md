# Prompt Sistemico per Claude Code

## Prima di ogni modifica al codice, segui questo workflow:

### 1. ANALISI PRE-MODIFICA
```
- Scansiona il progetto per codice simile/duplicato
- Identifica pattern esistenti da seguire
- Verifica l'architettura attuale del modulo
- Controlla dipendenze e accoppiamenti
```

### 2. PRINCIPI SOLID DA APPLICARE

**Single Responsibility Principle (SRP)**
- Ogni classe/modulo ha una sola ragione per cambiare
- Separa UI logic da business logic
- Mantieni distinct layers (data, business, presentation)

**Open/Closed Principle (OCP)**
- Usa composition over inheritance
- Implementa plugin/middleware patterns
- Design for extensibility

**Liskov Substitution Principle (LSP)**
- Le implementazioni devono essere intercambiabili
- Mantieni consistent interfaces

**Interface Segregation Principle (ISP)**
- Crea interfacce specifiche e focused
- Evita "fat interfaces"

**Dependency Inversion Principle (DIP)**
- Dipendi da abstractions, non da implementations
- Usa dependency injection

### 3. CHECKLIST PRE-COMMIT
```
□ Controllo duplicazioni
□ Verifica coerenza stile
□ Test di funzionalità
□ Controllo performance
□ Security review (per Electron)
□ Error handling implementato
□ Logging appropriato
□ Documentazione aggiornata
```

### 4. COMANDI SPECIFICI PER CLAUDE CODE

**Per evitare duplicazioni:**
```bash
"Cerca prima se esiste già una funzione che fa X"
"Refactorizza il codice duplicato in src/utils/"
"Crea un service condiviso per questa logica"
```

**Per architettura:**
```bash
"Separa questa logica in un modulo dedicato"
"Applica il pattern Strategy per questa funzionalità"
"Implementa un factory pattern per questi oggetti"
```

**Per Electron specifico:**
```bash
"Verifica che IPC sia sicuro e minimale"
"Controlla che non ci siano security vulnerabilities"
"Separa main process da renderer process"
```

### 5. TEMPLATE DI RISPOSTA ATTESO

Quando Claude Code modifica codice, dovrebbe sempre includere:

1. **Analisi**: "Ho trovato codice simile in [file], ho deciso di refactorizzare"
2. **Principi applicati**: "Applicato SRP separando X da Y"
3. **Struttura**: "Creato nuovo modulo in src/services/"
4. **Testing**: "Aggiunto error handling per caso Z"
5. **Next steps**: "Considera di implementare caching per performance"

### 7. GESTIONE EVENTI - PATTERN CENTRALIZZATO

**Event Manager Pattern:**
```javascript
// ✅ BUONO - Event Manager centralizzato
class EventManager {
  constructor() {
    this.events = new Map();
    this.listeners = new WeakMap();
  }

  // Registrazione unica per evitare duplicati
  on(eventName, listener, context = null) {
    const key = `${eventName}:${listener.name}`;
    
    if (this.events.has(key)) {
      console.warn(`Listener ${key} già registrato`);
      return;
    }

    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }
    
    this.events.get(eventName).push({ listener, context });
    this.events.set(key, true);
  }

  emit(eventName, data) {
    const listeners = this.events.get(eventName);
    if (!listeners) return;

    listeners.forEach(({ listener, context }) => {
      try {
        context ? listener.call(context, data) : listener(data);
      } catch (error) {
        console.error(`Error in listener for ${eventName}:`, error);
      }
    });
  }

  off(eventName, listener) {
    const key = `${eventName}:${listener.name}`;
    this.events.delete(key);
    
    const listeners = this.events.get(eventName);
    if (listeners) {
      const index = listeners.findIndex(l => l.listener === listener);
      if (index > -1) listeners.splice(index, 1);
    }
  }

  // Cleanup per evitare memory leaks
  cleanup(context) {
    for (const [eventName, listeners] of this.events) {
      if (Array.isArray(listeners)) {
        this.events.set(eventName, 
          listeners.filter(l => l.context !== context)
        );
      }
    }
  }
}

// Singleton instance
const eventManager = new EventManager();
export default eventManager;
```

**Electron IPC Events:**
```javascript
// ✅ BUONO - IPC centralizzato
// main/ipc-manager.js
class IPCManager {
  constructor() {
    this.channels = new Map();
  }

  register(channel, handler) {
    if (this.channels.has(channel)) {
      console.warn(`IPC channel ${channel} già registrato`);
      return;
    }

    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return await handler(event, ...args);
      } catch (error) {
        console.error(`IPC Error on ${channel}:`, error);
        throw error;
      }
    });

    this.channels.set(channel, handler);
  }

  unregister(channel) {
    if (this.channels.has(channel)) {
      ipcMain.removeHandler(channel);
      this.channels.delete(channel);
    }
  }
}

// ❌ CATTIVO - Handler duplicati
ipcMain.handle('save-file', handler1);
ipcMain.handle('save-file', handler2); // Sovrascrive il primo!
```

**DOM Events con Delegation:**
```javascript
// ✅ BUONO - Event delegation centralizzato
class DOMEventManager {
  constructor() {
    this.delegatedEvents = new Map();
    this.setupDelegation();
  }

  setupDelegation() {
    document.addEventListener('click', this.handleClick.bind(this));
    document.addEventListener('change', this.handleChange.bind(this));
  }

  handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (target) {
      const action = target.dataset.action;
      const handler = this.delegatedEvents.get(`click:${action}`);
      if (handler) handler(event, target);
    }
  }

  registerAction(eventType, action, handler) {
    const key = `${eventType}:${action}`;
    if (this.delegatedEvents.has(key)) {
      console.warn(`Action ${key} già registrata`);
      return;
    }
    this.delegatedEvents.set(key, handler);
  }
}

// HTML: <button data-action="save-file">Save</button>
// JS: domEvents.registerAction('click', 'save-file', handleSave);

// ❌ CATTIVO - Listener multipli
document.querySelectorAll('.save-btn').forEach(btn => {
  btn.addEventListener('click', handleSave); // Duplicazione!
});
```

**Custom Events per Componenti:**
```javascript
// ✅ BUONO - Custom events tipizzati
class ComponentEventManager {
  static createCustomEvent(name, detail = {}) {
    return new CustomEvent(`app:${name}`, {
      bubbles: true,
      cancelable: true,
      detail
    });
  }

  static dispatch(element, eventName, data) {
    const event = this.createCustomEvent(eventName, data);
    element.dispatchEvent(event);
  }

  static listen(element, eventName, handler) {
    const fullEventName = `app:${eventName}`;
    element.addEventListener(fullEventName, handler);
    
    // Return cleanup function
    return () => element.removeEventListener(fullEventName, handler);
  }
}

// Usage:
ComponentEventManager.dispatch(element, 'user:login', { userId: 123 });
const cleanup = ComponentEventManager.listen(
  document, 'user:login', handleUserLogin
);

// ❌ CATTIVO - Eventi non namespace
element.dispatchEvent(new Event('login')); // Conflitto possibile
```

### 8. CHECKLIST EVENTI
```
□ Usa Event Manager centralizzato
□ Namespace eventi (app:module:action)
□ Registrazione unica (no duplicati)
□ Cleanup listeners appropriato
□ Error handling negli event handlers
□ Event delegation per DOM events
□ IPC channels centralizzati (Electron)
□ Custom events tipizzati
□ Weak references quando possibile
□ Logging per debug eventi
```

### 9. ESEMPI DI BUONE PRATICHE

**JavaScript/Node:**
```javascript
// ✅ BUONO - Single Responsibility
class DatabaseService {
  async connect() { /* */ }
  async query(sql, params) { /* */ }
}

class UserService {
  constructor(dbService) {
    this.db = dbService; // Dependency Injection
  }
  async createUser(userData) { /* */ }
}

// ❌ CATTIVO - God Object
class UserManager {
  connect() { /* */ }
  query() { /* */ }
  createUser() { /* */ }
  sendEmail() { /* */ }
  logActivity() { /* */ }
}
```

**Electron IPC:**
```javascript
// ✅ BUONO - Sicuro e modulare
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  onFileChanged: (callback) => ipcRenderer.on('file-changed', callback)
});

// ❌ CATTIVO - nodeIntegration abilitato
// Non esporre tutto Node.js al renderer
```

**CSS/HTML:**
```css
/* ✅ BUONO - BEM e variabili centralized */
:root {
  --primary-color: #007bff;
  --spacing-unit: 1rem;
}

.button {
  background: var(--primary-color);
  padding: var(--spacing-unit);
}

.button--large {
  padding: calc(var(--spacing-unit) * 1.5);
}

/* ❌ CATTIVO - Hardcoded values */
.btn {
  background: #007bff;
  padding: 16px;
}
.big-btn {
  background: #007bff;
  padding: 24px;
}
```
