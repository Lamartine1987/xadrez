const fs = require('fs');
const raw = fs.readFileSync('src/index.css');

let text = raw.toString('utf8');
let idx = text.indexOf('/* Horizontal Scroll Utilities */');

let cleanText = text.substring(0, idx);

let correctCss = `/* Horizontal Scroll Utilities */
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Tutorial Layout */
.tutorial-layout {
  display: flex;
  flex-direction: row;
  gap: 20px;
  padding: 16px;
  max-width: 1000px;
  margin: 0 auto;
  min-height: 120vh;
}

.tutorial-sidebar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 280px;
  flex-shrink: 0;
}

.tutorial-sidebar .btn {
  justify-content: flex-start;
  text-align: left;
}

.tutorial-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 600px;
  align-items: stretch;
}

@media (max-width: 768px) {
  .tutorial-layout {
    flex-direction: column;
  }
  .tutorial-sidebar {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    white-space: nowrap;
    padding-bottom: 10px;
  }
  .tutorial-sidebar .btn {
    justify-content: center;
    text-align: center;
  }
}
`;

fs.writeFileSync('src/index.css', cleanText + correctCss, 'utf8');
console.log('Fixed CSS encoding and content');
