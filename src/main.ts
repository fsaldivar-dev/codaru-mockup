import './style.css';
import './chrome-style.css';
import { createEditorRuntime } from './editor-runtime';
const runtime = createEditorRuntime({ app: document.querySelector<HTMLDivElement>('#app')! });
Object.defineProperty(window, 'codaru', { value: runtime.api, writable: false });
