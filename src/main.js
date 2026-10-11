// Entry point: global styles, then start the app. The real work lives in src/app/.
import './styles/tokens.css';
import './styles/glass.css';
import './styles/base.css';
import './brand/brand.css';
import { boot } from './app/boot.js';

boot();
