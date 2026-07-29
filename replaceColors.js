const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'frontend', 'src');

const replacements = [
  { regex: /#0d1117/gi, replacement: "var(--bg-primary)" },
  { regex: /#161b22/gi, replacement: "var(--bg-secondary)" },
  { regex: /#21262d/gi, replacement: "var(--bg-tertiary)" },
  { regex: /#30363d/gi, replacement: "var(--border-color)" },
  { regex: /#ffffff/gi, replacement: "var(--text-primary)" },
  { regex: /#fff/gi, replacement: "var(--text-primary)" },
  { regex: /#c9d1d9/gi, replacement: "var(--text-secondary)" },
  { regex: /#8b949e/gi, replacement: "var(--text-muted)" },
  { regex: /#58a6ff/gi, replacement: "var(--accent-blue)" },
  { regex: /#1f6feb/gi, replacement: "var(--accent-blue-bg)" },
  { regex: /#2ea043/gi, replacement: "var(--accent-green)" },
  { regex: /#238636/gi, replacement: "var(--accent-green-bg)" },
  { regex: /#d29922/gi, replacement: "var(--accent-gold)" },
  { regex: /#f85149/gi, replacement: "var(--accent-red)" },
  { regex: /#da3633/gi, replacement: "var(--accent-red-bg)" },
  { regex: /#010409/gi, replacement: "var(--bg-primary)" },
  { regex: /#e6edf3/gi, replacement: "var(--text-primary)" },
  { regex: /#1f242c/gi, replacement: "var(--bg-hover)" },
  { regex: /#1f2633/gi, replacement: "var(--bg-hover)" }
];

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let original = content;
      
      for (const { regex, replacement } of replacements) {
        content = content.replace(regex, replacement);
      }
      
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

console.log("Starting replacement...");
processDirectory(DIR);
console.log("Done.");
