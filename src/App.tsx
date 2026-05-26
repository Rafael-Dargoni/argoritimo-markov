import { useState, useEffect } from 'react';

// Interface de Regra do ANM
interface Rule {
  id: string;
  lhs: string; // Left-hand side (lado esquerdo)
  rhs: string; // Right-hand side (lado direito)
  isTerminal: boolean; // Indica se é uma regra de parada (u -> .v)
}

// Registro de passo no histórico
interface HistoryEntry {
  step: number;
  wordBefore: string;
  wordAfter: string;
  ruleApplied: Rule | null;
  ruleIndex: number;
  matchStart: number;
  matchLength: number;
  status: 'start' | 'normal' | 'terminal' | 'no_match' | 'limit_reached';
}

// Configuração de Presets
interface Preset {
  name: string;
  description: string;
  initialWord: string;
  rules: Rule[];
  academicNote?: string;
}

// Presets acadêmicos definidos fora do componente para evitar recriação e garantir imutabilidade
const presets: Preset[] = [
  {
    name: 'Exemplo da Apresentação 🎓',
    description: 'Ordena e reduz letras {a, b} conforme seu material de apoio.',
    initialWord: 'aabb',
    rules: [
      { id: 'ex-1', lhs: 'ab', rhs: 'ba', isTerminal: false },
      { id: 'ex-2', lhs: 'aa', rhs: 'a', isTerminal: false },
      { id: 'ex-3', lhs: 'bb', rhs: 'b', isTerminal: false }
    ],
    academicNote: 'Este é o exemplo exato do seu material! Em LFA, o algoritmo busca sempre o casamento mais à esquerda (leftmost). Por isso, a execução formal segue o caminho: aabb -> abab -> baab -> bbaa -> bba -> ba (concluído em 5 transições). O trace manual de 7 passos comum em apresentações ocorre quando comutamos voluntariamente a segunda ocorrência de "ab" antes da primeira no passo 2!'
  },
  {
    name: 'Soma Unária (A + B) ➕',
    description: 'Soma dois números unários representados por "1"s (ex: 111 + 11 = 11111).',
    initialWord: '111+11',
    rules: [
      { id: 'add-1', lhs: '+1', rhs: '1+', isTerminal: false },
      { id: 'add-2', lhs: '+', rhs: '', isTerminal: true }
    ],
    academicNote: 'Desloca o símbolo "+" para o final da string de forma iterativa através do caractere "1". Quando atinge a borda direita, o "+" é deletado usando uma regra terminal, parando a simulação.'
  },
  {
    name: 'Incremento Binário 🔢',
    description: 'Adiciona 1 a um número binário usando o marcador "p" à direita (ex: 1011p -> 1100).',
    initialWord: '1011p',
    rules: [
      { id: 'inc-1', lhs: '1p', rhs: 'p0', isTerminal: false },
      { id: 'inc-2', lhs: '0p', rhs: '1', isTerminal: true },
      { id: 'inc-3', lhs: 'p', rhs: '1', isTerminal: true }
    ],
    academicNote: 'Ilustra a lógica de carry (transporte/vai-um). O marcador "p" atua como a cabeça de gravação. Ele converte "1" em "0" e move-se para a esquerda. Ao achar um "0", ele o converte em "1" e para (regra terminal). Se alcançar a borda esquerda (apenas "p"), vira "1" e para.'
  },
  {
    name: 'Ordenador de Letras (Bubble Sort) 🔀',
    description: 'Ordena caracteres ba -> ab fazendo os "a"s flutuarem para o início.',
    initialWord: 'bababa',
    rules: [
      { id: 'sort-1', lhs: 'ba', rhs: 'ab', isTerminal: false }
    ],
    academicNote: 'Demonstra como regras locais de reescrita podem surtir efeitos globais de ordenação, comportando-se exatamente como o algoritmo de ordenação bolha (bubble sort).'
  },
  {
    name: 'Conversor Binário para Unário 🔄',
    description: 'Converte binário para unário (ex: 101 [5] -> ||||| [5]).',
    initialWord: '101',
    rules: [
      { id: 'conv-1', lhs: '1', rhs: '0|', isTerminal: false },
      { id: 'conv-2', lhs: '|0', rhs: '0||', isTerminal: false },
      { id: 'conv-3', lhs: '0', rhs: '', isTerminal: false }
    ],
    academicNote: 'Um algoritmo de Markov sofisticado que utiliza o marcador "|" para contar. Cada "1" vira um "0" e um "|". Os "|" atravessam os "0" para a direita, duplicando-se a cada salto para manter a potência binária. Por fim, todos os "0"s são deletados.'
  },
  {
    name: 'Duplicador Unário 👥',
    description: 'Duplica uma sequência de "1"s separada pelo marcador X (ex: 111X -> 111111).',
    initialWord: '111X',
    rules: [
      { id: 'dup-1', lhs: '1X', rhs: 'X11', isTerminal: false },
      { id: 'dup-2', lhs: 'X', rhs: '', isTerminal: true }
    ],
    academicNote: 'Demonstra a duplicação de strings. A regra 1 consome os "1"s da esquerda do marcador X e produz o dobro à direita de X, enquanto X caminha para a esquerda. Quando X atinge a ponta esquerda, ele é apagado de forma terminal.'
  }
];

export default function MarkovDemo() {
  // Estados principais
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  // Inicialização segura com deep copy para não modificar o array presets estático
  const [rules, setRules] = useState<Rule[]>(() => presets[0].rules.map(r => ({ ...r })));
  const [initialWord, setInitialWord] = useState<string>(presets[0].initialWord);
  const [currentWord, setCurrentWord] = useState<string>(presets[0].initialWord);
  
  // Controle da simulação
  const [stepCount, setStepCount] = useState<number>(0);
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      step: 0,
      wordBefore: presets[0].initialWord,
      wordAfter: presets[0].initialWord,
      ruleApplied: null,
      ruleIndex: -1,
      matchStart: -1,
      matchLength: -1,
      status: 'start'
    }
  ]);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState<number>(0);
  const [running, setRunning] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(800); // ms por passo
  const [maxStepsLimit] = useState<number>(500); // segurança contra loop
  
  // Detalhes do passo atual
  const [status, setStatus] = useState<'idle' | 'running' | 'halted_terminal' | 'halted_no_match' | 'halted_limit'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Pronto para iniciar a simulação.');
  const [currentMatch, setCurrentMatch] = useState<{ ruleIndex: number; start: number; length: number } | null>(null);

  // Interface de ajuda - Controle de abas
  const [activeTab, setActiveTab] = useState<'concept' | 'execution' | 'turing' | 'presentation'>('presentation');

  // Carregar preset
  const handleSelectPreset = (index: number) => {
    setSelectedPresetIndex(index);
    const preset = presets[index];
    const newRules = preset.rules.map(r => ({ ...r })); // Deep copy
    setRules(newRules);
    setInitialWord(preset.initialWord);
    
    // Reseta a simulação usando os novos parâmetros explicitamente
    setRunning(false);
    setCurrentWord(preset.initialWord);
    setStepCount(0);
    setActiveHistoryIndex(0);
    setHistory([
      {
        step: 0,
        wordBefore: preset.initialWord,
        wordAfter: preset.initialWord,
        ruleApplied: null,
        ruleIndex: -1,
        matchStart: -1,
        matchLength: -1,
        status: 'start'
      }
    ]);
    setStatus('idle');
    setStatusMessage('Simulação reiniciada. Clique em "Avançar" para iniciar.');
    setCurrentMatch(null);
  };

  // Resetar simulação
  const resetSimulation = (word = initialWord) => {
    setRunning(false);
    setCurrentWord(word);
    setStepCount(0);
    setActiveHistoryIndex(0);
    const initialEntry: HistoryEntry = {
      step: 0,
      wordBefore: word,
      wordAfter: word,
      ruleApplied: null,
      ruleIndex: -1,
      matchStart: -1,
      matchLength: -1,
      status: 'start'
    };
    setHistory([initialEntry]);
    setStatus('idle');
    setStatusMessage('Simulação reiniciada. Clique em "Avançar" para iniciar.');
    setCurrentMatch(null);
  };

  // Parar simulação automática
  const stopAutoSimulate = () => {
    setRunning(false);
  };

  // Executa exatamente um passo do algoritmo
  const executeSingleStep = (): boolean => {
    // Se já estiver travado em estado de término
    if (status === 'halted_terminal' || status === 'halted_no_match' || status === 'halted_limit') {
      return false;
    }

    // Se o usuário selecionou um estado intermediário no histórico, reseta o progresso a partir dali
    let activeWord = currentWord;
    let currentStep = stepCount;
    let currentHist = [...history];

    if (activeHistoryIndex < history.length - 1) {
      currentHist = history.slice(0, activeHistoryIndex + 1);
      activeWord = currentHist[activeHistoryIndex].wordAfter;
      currentStep = activeHistoryIndex;
    }

    // Segurança contra loop
    if (currentStep >= maxStepsLimit) {
      setStatus('halted_limit');
      setStatusMessage(`Limite de segurança de ${maxStepsLimit} passos atingido (Loop infinito evitado).`);
      
      const errorEntry: HistoryEntry = {
        step: currentStep + 1,
        wordBefore: activeWord,
        wordAfter: activeWord,
        ruleApplied: null,
        ruleIndex: -1,
        matchStart: -1,
        matchLength: -1,
        status: 'limit_reached'
      };
      
      setHistory([...currentHist, errorEntry]);
      setActiveHistoryIndex(currentStep + 1);
      setCurrentWord(activeWord);
      setStepCount(currentStep + 1);
      setCurrentMatch(null);
      return false;
    }

    // Varre as regras na ordem definida (Top-to-Bottom)
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];

      // Caso especial: LHS vazia insere RHS no início da string
      if (rule.lhs === '') {
        const wordAfter = rule.rhs + activeWord;
        const newEntry: HistoryEntry = {
          step: currentStep + 1,
          wordBefore: activeWord,
          wordAfter,
          ruleApplied: rule,
          ruleIndex: i,
          matchStart: 0,
          matchLength: 0,
          status: rule.isTerminal ? 'terminal' : 'normal'
        };

        const updatedHist = [...currentHist, newEntry];
        setHistory(updatedHist);
        setActiveHistoryIndex(updatedHist.length - 1);
        setCurrentWord(wordAfter);
        setStepCount(currentStep + 1);
        setCurrentMatch({ ruleIndex: i, start: 0, length: 0 });

        if (rule.isTerminal) {
          setStatus('halted_terminal');
          setStatusMessage(`Parado: Regra terminal ${i + 1} (${rule.lhs || 'ε'} → .${rule.rhs || 'ε'}) aplicada.`);
        } else {
          setStatusMessage(`Regra ${i + 1} (${rule.lhs || 'ε'} → ${rule.rhs || 'ε'}) aplicada no início.`);
        }
        return !rule.isTerminal;
      }

      // Busca ocorrência leftmost
      const index = activeWord.indexOf(rule.lhs);
      if (index !== -1) {
        const wordAfter = 
          activeWord.substring(0, index) + 
          rule.rhs + 
          activeWord.substring(index + rule.lhs.length);

        const newEntry: HistoryEntry = {
          step: currentStep + 1,
          wordBefore: activeWord,
          wordAfter,
          ruleApplied: rule,
          ruleIndex: i,
          matchStart: index,
          matchLength: rule.lhs.length,
          status: rule.isTerminal ? 'terminal' : 'normal'
        };

        const updatedHist = [...currentHist, newEntry];
        setHistory(updatedHist);
        setActiveHistoryIndex(updatedHist.length - 1);
        setCurrentWord(wordAfter);
        setStepCount(currentStep + 1);
        setCurrentMatch({ ruleIndex: i, start: index, length: rule.lhs.length });

        if (rule.isTerminal) {
          setStatus('halted_terminal');
          setStatusMessage(`Parado: Regra terminal ${i + 1} ("${rule.lhs}" → ."${rule.rhs}") aplicada no índice ${index}.`);
        } else {
          setStatusMessage(`Regra ${i + 1} ("${rule.lhs}" → "${rule.rhs}") aplicada no índice ${index}.`);
        }
        return !rule.isTerminal;
      }
    }

    // Nenhuma regra casou
    setStatus('halted_no_match');
    setStatusMessage('Parado: Nenhuma regra na lista corresponde à palavra atual.');
    
    const haltEntry: HistoryEntry = {
      step: currentStep + 1,
      wordBefore: activeWord,
      wordAfter: activeWord,
      ruleApplied: null,
      ruleIndex: -1,
      matchStart: -1,
      matchLength: -1,
      status: 'no_match'
    };

    const updatedHist = [...currentHist, haltEntry];
    setHistory(updatedHist);
    setActiveHistoryIndex(updatedHist.length - 1);
    setCurrentWord(activeWord);
    setStepCount(currentStep + 1);
    setCurrentMatch(null);
    return false;
  };

  // Efeito de execução automática usando setTimeout para evitar loops descontrolados e closures stale
  useEffect(() => {
    if (!running) return;

    const timeout = setTimeout(() => {
      const nextState = executeSingleStep();
      if (!nextState) {
        setRunning(false);
      }
    }, speed);

    return () => clearTimeout(timeout);
  }, [running, speed, currentWord, rules, stepCount, history, activeHistoryIndex, status]);

  // Volta um passo da simulação (Undo)
  const handleStepBackward = () => {
    if (activeHistoryIndex > 0) {
      stopAutoSimulate();
      const prevIndex = activeHistoryIndex - 1;
      setActiveHistoryIndex(prevIndex);
      
      const prevEntry = history[prevIndex];
      setCurrentWord(prevEntry.wordAfter);
      setStepCount(prevIndex);
      
      // Ajusta o destaque para o passo anterior se houver regra aplicada
      if (prevIndex > 0) {
        const currentEntry = history[prevIndex];
        if (currentEntry.ruleApplied) {
          setCurrentMatch({
            ruleIndex: currentEntry.ruleIndex,
            start: currentEntry.matchStart,
            length: currentEntry.matchLength
          });
          setStatus('idle');
          setStatusMessage(`Retornado ao Passo ${prevIndex}. Regra ${currentEntry.ruleIndex + 1} aplicada.`);
        } else {
          setCurrentMatch(null);
          setStatus('idle');
          setStatusMessage(`Retornado ao Passo ${prevIndex}.`);
        }
      } else {
        setCurrentMatch(null);
        setStatus('idle');
        setStatusMessage('Retornado ao estado inicial.');
      }
    }
  };

  // Avança um passo (Wrapper para controle manual)
  const handleStepForward = () => {
    stopAutoSimulate();
    
    // Se estamos navegando no meio do histórico, avançamos o ponteiro
    if (activeHistoryIndex < history.length - 1) {
      const nextIndex = activeHistoryIndex + 1;
      setActiveHistoryIndex(nextIndex);
      const nextEntry = history[nextIndex];
      setCurrentWord(nextEntry.wordAfter);
      setStepCount(nextIndex);
      if (nextEntry.ruleApplied) {
        setCurrentMatch({
          ruleIndex: nextEntry.ruleIndex,
          start: nextEntry.matchStart,
          length: nextEntry.matchLength
        });
        setStatusMessage(`Avançado para o Passo ${nextIndex}. Regra ${nextEntry.ruleIndex + 1} aplicada.`);
      } else {
        setCurrentMatch(null);
        if (nextEntry.status === 'no_match') {
          setStatus('halted_no_match');
          setStatusMessage('Parado: Nenhuma regra na lista corresponde à palavra.');
        } else if (nextEntry.status === 'limit_reached') {
          setStatus('halted_limit');
          setStatusMessage('Limite de passos atingido.');
        }
      }
    } else {
      executeSingleStep();
    }
  };

  // Executa a simulação inteira de uma vez
  const handleRunToEnd = () => {
    stopAutoSimulate();
    let currentActiveWord = currentWord;
    let currentStep = stepCount;
    let currentHist = [...history];

    if (activeHistoryIndex < history.length - 1) {
      currentHist = history.slice(0, activeHistoryIndex + 1);
      currentActiveWord = currentHist[activeHistoryIndex].wordAfter;
      currentStep = activeHistoryIndex;
    }

    let isRunning = true;
    let safetyCounter = 0;

    // Lógica síncrona até parada
    while (isRunning && safetyCounter < maxStepsLimit) {
      safetyCounter++;
      let ruleMatched = false;

      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];

        // Regra com LHS vazia
        if (rule.lhs === '') {
          const wordAfter = rule.rhs + currentActiveWord;
          const newEntry: HistoryEntry = {
            step: currentStep + 1,
            wordBefore: currentActiveWord,
            wordAfter,
            ruleApplied: rule,
            ruleIndex: i,
            matchStart: 0,
            matchLength: 0,
            status: rule.isTerminal ? 'terminal' : 'normal'
          };
          currentHist.push(newEntry);
          currentActiveWord = wordAfter;
          currentStep++;
          ruleMatched = true;

          if (rule.isTerminal) {
            setStatus('halted_terminal');
            setStatusMessage(`Parado: Regra terminal ${i + 1} (${rule.lhs || 'ε'} → .${rule.rhs || 'ε'}) aplicada.`);
            isRunning = false;
          }
          break;
        }

        const index = currentActiveWord.indexOf(rule.lhs);
        if (index !== -1) {
          const wordAfter = 
            currentActiveWord.substring(0, index) + 
            rule.rhs + 
            currentActiveWord.substring(index + rule.lhs.length);

          const newEntry: HistoryEntry = {
            step: currentStep + 1,
            wordBefore: currentActiveWord,
            wordAfter,
            ruleApplied: rule,
            ruleIndex: i,
            matchStart: index,
            matchLength: rule.lhs.length,
            status: rule.isTerminal ? 'terminal' : 'normal'
          };
          currentHist.push(newEntry);
          currentActiveWord = wordAfter;
          currentStep++;
          ruleMatched = true;

          if (rule.isTerminal) {
            setStatus('halted_terminal');
            setStatusMessage(`Parado: Regra terminal ${i + 1} ("${rule.lhs}" → ."${rule.rhs}") aplicada.`);
            isRunning = false;
          }
          break;
        }
      }

      if (!ruleMatched) {
        // Sem match
        const haltEntry: HistoryEntry = {
          step: currentStep + 1,
          wordBefore: currentActiveWord,
          wordAfter: currentActiveWord,
          ruleApplied: null,
          ruleIndex: -1,
          matchStart: -1,
          matchLength: -1,
          status: 'no_match'
        };
        currentHist.push(haltEntry);
        setStatus('halted_no_match');
        setStatusMessage('Parado: Nenhuma regra corresponde à palavra.');
        isRunning = false;
      }
    }

    if (safetyCounter >= maxStepsLimit) {
      const errorEntry: HistoryEntry = {
        step: currentStep + 1,
        wordBefore: currentActiveWord,
        wordAfter: currentActiveWord,
        ruleApplied: null,
        ruleIndex: -1,
        matchStart: -1,
        matchLength: -1,
        status: 'limit_reached'
      };
      currentHist.push(errorEntry);
      setStatus('halted_limit');
      setStatusMessage(`Parado: Limite máximo de ${maxStepsLimit} passos atingido (Loop infinito evitado).`);
    }

    setHistory(currentHist);
    setActiveHistoryIndex(currentHist.length - 1);
    setCurrentWord(currentActiveWord);
    setStepCount(currentHist.length - 1);
    
    // Configura o último match visual
    const lastValidEntry = currentHist[currentHist.length - 2];
    if (lastValidEntry && lastValidEntry.ruleApplied) {
      setCurrentMatch({
        ruleIndex: lastValidEntry.ruleIndex,
        start: lastValidEntry.matchStart,
        length: lastValidEntry.matchLength
      });
    } else {
      setCurrentMatch(null);
    }
  };

  // Clica num passo do histórico para voltar no tempo
  const handleSelectHistoryItem = (idx: number) => {
    stopAutoSimulate();
    setActiveHistoryIndex(idx);
    const entry = history[idx];
    setCurrentWord(entry.wordAfter);
    setStepCount(idx);

    if (entry.ruleApplied) {
      setCurrentMatch({
        ruleIndex: entry.ruleIndex,
        start: entry.matchStart,
        length: entry.matchLength
      });
      setStatus('idle');
      setStatusMessage(`Visualizando o Passo ${idx}. Regra ${entry.ruleIndex + 1} aplicada.`);
    } else {
      setCurrentMatch(null);
      if (entry.status === 'start') {
        setStatusMessage('Visualizando o estado inicial.');
      } else if (entry.status === 'no_match') {
        setStatusMessage('Parado: Nenhuma regra corresponde.');
      } else if (entry.status === 'limit_reached') {
        setStatusMessage('Limite de execução atingido.');
      }
    }
  };

  // Altera a palavra inicial
  const handleWordInputChange = (val: string) => {
    setInitialWord(val);
    resetSimulation(val);
  };

  // --- Funções do Editor de Regras (Seguras e Imutáveis) ---
  
  // Atualiza campo de uma regra de forma imutável
  const handleUpdateRuleField = (index: number, field: 'lhs' | 'rhs', value: string) => {
    setRules(prevRules => prevRules.map((rule, i) => {
      if (i === index) {
        return { ...rule, [field]: value };
      }
      return rule;
    }));
    resetSimulation(initialWord);
  };

  // Alterna terminalidade de forma imutável
  const handleToggleTerminal = (index: number) => {
    setRules(prevRules => prevRules.map((rule, i) => {
      if (i === index) {
        return { ...rule, isTerminal: !rule.isTerminal };
      }
      return rule;
    }));
    resetSimulation(initialWord);
  };

  // Move regra para cima
  const handleMoveRuleUp = (index: number) => {
    if (index > 0) {
      setRules(prevRules => {
        const updated = [...prevRules];
        const temp = updated[index];
        updated[index] = updated[index - 1];
        updated[index - 1] = temp;
        return updated;
      });
      resetSimulation(initialWord);
    }
  };

  // Move regra para baixo
  const handleMoveRuleDown = (index: number) => {
    if (index < rules.length - 1) {
      setRules(prevRules => {
        const updated = [...prevRules];
        const temp = updated[index];
        updated[index] = updated[index + 1];
        updated[index + 1] = temp;
        return updated;
      });
      resetSimulation(initialWord);
    }
  };

  // Remove regra
  const handleRemoveRule = (index: number) => {
    setRules(prevRules => prevRules.filter((_, i) => i !== index));
    resetSimulation(initialWord);
  };

  // Adiciona regra
  const handleAddRule = () => {
    const newRule: Rule = {
      id: `rule-${Date.now()}`,
      lhs: 'a',
      rhs: 'b',
      isTerminal: false
    };
    setRules(prevRules => [...prevRules, newRule]);
    resetSimulation(initialWord);
  };

  // Limpa todas as regras
  const handleClearAllRules = () => {
    setRules([]);
    resetSimulation(initialWord);
  };

  // --- Renderizadores Auxiliares ---
  
  // Desenha a string dividida em caixas individuais
  const renderStringBlocks = () => {
    if (currentWord === '') {
      return <div className="char-block empty">Palavra Vazia (ε)</div>;
    }

    const chars = currentWord.split('');
    const match = currentMatch;

    return (
      <div className="string-container">
        {chars.map((char, idx) => {
          let isCharMatched = false;
          if (match) {
            isCharMatched = idx >= match.start && idx < match.start + match.length;
          }

          return (
            <div
              key={idx}
              className={`char-block ${isCharMatched ? 'matched pulse-glow' : ''}`}
            >
              {char}
            </div>
          );
        })}
      </div>
    );
  };

  // Desenha a visualização da substituição (match → replacement)
  const renderMatchOverlay = () => {
    const entry = history[activeHistoryIndex];
    if (!entry || !entry.ruleApplied || entry.matchLength === -1) {
      return null;
    }

    const matchedPart = entry.wordBefore.substring(
      entry.matchStart,
      entry.matchStart + entry.matchLength
    );
    const replacementPart = entry.ruleApplied.rhs;

    return (
      <div className="match-hint-overlay">
        <div className="match-arrow">↓</div>
        <div className="replacement-container">
          {replacementPart.split('').map((char, idx) => (
            <div key={idx} className="char-block replaced">
              {char}
            </div>
          ))}
          {replacementPart === '' && (
            <div className="char-block replaced empty" style={{ width: '42px', height: '48px', fontSize: '12px' }}>
              ε
            </div>
          )}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Substituição: &quot;{matchedPart || 'ε'}&quot; → &quot;{replacementPart || 'ε'}&quot;
        </div>
      </div>
    );
  };

  // Detalhes da regra aplicada no passo visualizado
  const getActiveRuleDescription = () => {
    const entry = history[activeHistoryIndex];
    if (entry && entry.ruleApplied) {
      return `Regra ${entry.ruleIndex + 1}: ${entry.ruleApplied.lhs || 'ε'} → ${entry.ruleApplied.isTerminal ? '.' : ''}${entry.ruleApplied.rhs || 'ε'}`;
    }
    return 'Nenhuma';
  };

  return (
    <div className="app-container">
      {/* Cabeçalho */}
      <header className="app-header">
        <div className="header-title-area">
          <h1>Simulador de Algoritmo Normal de Markov</h1>
          <p>Linguagens Formais, Autômatos e Reescrita de Símbolos</p>
        </div>
        <div className="badge-container">
          <span className="badge badge-info">Turing Completo</span>
          <span className="badge badge-accent">Teoria de Computação</span>
        </div>
      </header>

      {/* Grid Principal */}
      <main className="dashboard-grid">
        
        {/* Coluna Esquerda: Presets & Editor de Regras */}
        <section className="left-column" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Seção de Presets */}
          <div className="glass-card">
            <h2 className="card-title">
              <span>Presets Didáticos</span>
              <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
                Selecione para carregar
              </span>
            </h2>
            <div className="preset-grid">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectPreset(idx)}
                  className={`preset-btn ${idx === selectedPresetIndex ? 'active' : ''}`}
                >
                  <span className="preset-name">{preset.name}</span>
                  <span className="preset-desc">{preset.description}</span>
                </button>
              ))}
            </div>
            {presets[selectedPresetIndex]?.academicNote && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                background: 'var(--color-accent-glow)',
                borderLeft: '3px solid var(--color-accent)',
                borderRadius: '0 var(--radius-md) var(--radius-md) 0',
                fontSize: '11px',
                lineHeight: '1.4',
                color: 'var(--text-secondary)'
              }}>
                <strong>Nota Acadêmica:</strong> {presets[selectedPresetIndex].academicNote}
              </div>
            )}
          </div>

          {/* Editor de Regras */}
          <div className="glass-card" style={{ flexGrow: 1 }}>
            <h2 className="card-title">
              <span>Lista de Regras</span>
              <button 
                onClick={handleClearAllRules}
                className="btn-icon btn-icon-danger" 
                title="Limpar todas as regras"
                style={{ fontSize: '11px', width: 'auto', padding: '0 8px' }}
              >
                Limpar Todas
              </button>
            </h2>

            <div className="rules-container">
              {rules.map((rule, index) => {
                const isCurrentStepRule = currentMatch && currentMatch.ruleIndex === index;
                
                return (
                  <div 
                    key={rule.id} 
                    className={`rule-row ${isCurrentStepRule ? 'matched' : ''}`}
                  >
                    <div className="rule-number">{index + 1}</div>
                    
                    <input
                      type="text"
                      value={rule.lhs}
                      onChange={(e) => handleUpdateRuleField(index, 'lhs', e.target.value)}
                      placeholder="padrão"
                      className="rule-input"
                      title="Lado Esquerdo: substring a ser buscada"
                    />
                    
                    <span className="rule-arrow">
                      {rule.isTerminal ? '→ .' : '→'}
                    </span>
                    
                    <input
                      type="text"
                      value={rule.rhs}
                      onChange={(e) => handleUpdateRuleField(index, 'rhs', e.target.value)}
                      placeholder="substituir"
                      className="rule-input"
                      title="Lado Direito: string que substituirá a original"
                    />

                    <button
                      onClick={() => handleToggleTerminal(index)}
                      className={`terminal-toggle ${rule.isTerminal ? 'active' : ''}`}
                      title={rule.isTerminal ? "Regra Terminal (Para a máquina após aplicar)" : "Tornar Regra Terminal"}
                    >
                      Terminal
                    </button>

                    <div className="rule-actions">
                      <button
                        onClick={() => handleMoveRuleUp(index)}
                        disabled={index === 0}
                        className="btn-icon"
                        title="Subir prioridade da regra"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveRuleDown(index)}
                        disabled={index === rules.length - 1}
                        className="btn-icon"
                        title="Descer prioridade da regra"
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => handleRemoveRule(index)}
                        className="btn-icon btn-icon-danger"
                        title="Excluir regra"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {rules.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Nenhuma regra cadastrada. Adicione regras abaixo para começar.
                </div>
              )}
            </div>

            <button 
              onClick={handleAddRule} 
              className="add-rule-btn"
              style={{ width: '100%' }}
            >
              ➕ Adicionar Nova Regra
            </button>
          </div>

               {/* Membros da Equipe */}
          <div className="glass-card">
            <h2 className="card-title">Membros da Equipe</h2>
            <div className="team-member-list">
              <div className="team-member-item">RAFAEL ANTONIO SCHIRNER DARGONI</div>
              <div className="team-member-item">THIAGO FONSECA RODRIGUES MARTINS</div>
              <div className="team-member-item">VINICIUS AUGUSTO CORREA LEITE</div>
              <div className="team-member-item">VINICIUS COTRIM AZZI</div>
            </div>
          </div>

        </section>

        {/* Coluna Direita: Visualizador, Controles, Histórico */}
        <section className="right-column" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Cartão do Visualizador */}
          <div className="glass-card">
            
            {/* Input de String */}
            <div className="input-section">
              <div className="word-input-container">
                <span className="input-label">Palavra de Entrada Inicial</span>
                <input
                  type="text"
                  value={initialWord}
                  onChange={(e) => handleWordInputChange(e.target.value)}
                  placeholder="Ex: aabb, 111+11"
                  className="word-input"
                />
              </div>
              <button 
                onClick={() => resetSimulation()} 
                className="btn btn-secondary"
                title="Resetar palavra para o estado inicial"
              >
                🔄 Reiniciar
              </button>
            </div>

            {/* Quadro de Visualização de Reescrita */}
            <div className="visualization-board">
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', position: 'absolute', top: '10px', left: '15px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                Painel Visualizador de String
              </div>
              
              {/* String de Entrada / Atual */}
              {renderStringBlocks()}

              {/* Substituição ocorrendo */}
              {renderMatchOverlay()}

              {/* Informações inferiores do estado */}
              <div className="execution-status-panel">
                <div>
                  <span className="status-message">
                    Status: <strong className={
                      status.startsWith('halted_terminal') ? 'success' :
                      status.startsWith('halted_no_match') ? 'warning' :
                      status.startsWith('halted_limit') ? 'error' : ''
                    }>
                      {status === 'idle' && 'Ocioso'}
                      {status === 'running' && 'Simulando...'}
                      {status === 'halted_terminal' && 'Parado (Regra Terminal)'}
                      {status === 'halted_no_match' && 'Finalizado (Sem Match)'}
                      {status === 'halted_limit' && 'Erro (Loop Evitado)'}
                    </strong>
                  </span>
                </div>
                <div>
                  Regra Aplicada: <code style={{ fontSize: '11px', padding: '2px 6px', background: 'var(--bg-main)' }}>{getActiveRuleDescription()}</code>
                </div>
                <div className="step-counter">
                  Passo: {stepCount} / {activeHistoryIndex} no Histórico
                </div>
              </div>
            </div>

            {/* Controle da Simulação */}
            <div className="control-bar">
              <div className="control-btn-group">
                <button
                  onClick={handleStepBackward}
                  disabled={activeHistoryIndex === 0}
                  className="btn btn-secondary"
                  title="Voltar um passo na história (Undo)"
                >
                  ⏮️ Voltar
                </button>

                <button
                  onClick={() => setRunning(!running)}
                  disabled={status.startsWith('halted')}
                  className={`btn ${running ? 'btn-danger' : 'btn-primary'}`}
                  title={running ? "Pausar auto-execução" : "Executar simulação automaticamente"}
                >
                  {running ? '⏸️ Pausar' : '▶️ Auto Simular'}
                </button>

                <button
                  onClick={handleStepForward}
                  disabled={status.startsWith('halted')}
                  className="btn btn-secondary"
                  title="Avançar exatamente um passo"
                >
                  ⏭️ Avançar
                </button>

                <button
                  onClick={handleRunToEnd}
                  disabled={status.startsWith('halted')}
                  className="btn btn-accent"
                  title="Executar todo o algoritmo de uma vez"
                >
                  🚀 Executar Tudo
                </button>
              </div>

              {/* Slider de Velocidade */}
              <div className="speed-panel">
                <span className="speed-label">Velocidade:</span>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="speed-slider"
                />
                <span className="speed-value">{speed}ms</span>
              </div>
            </div>

            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: '1.4'
            }}>
              💡 <strong>Rastreamento:</strong> {statusMessage}
            </div>

          </div>

          {/* Histórico de Transições */}
          <div className="glass-card history-section">
            <div className="history-header">
              <h2 className="card-title" style={{ margin: 0 }}>Histórico de Execução</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {history.length} estados registrados
              </span>
            </div>
            
            <div className="history-list">
              {history.map((item, idx) => {
                const isActive = idx === activeHistoryIndex;
                const ruleText = item.ruleApplied 
                  ? `${item.ruleApplied.lhs || 'ε'} → ${item.ruleApplied.isTerminal ? '.' : ''}${item.ruleApplied.rhs || 'ε'}`
                  : '';
                
                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectHistoryItem(idx)}
                    className={`history-item ${isActive ? 'active' : ''}`}
                    title="Clique para inspecionar este estado"
                  >
                    <span className="hist-step">Passo {item.step}</span>
                    <span className="hist-word" title={item.wordBefore}>
                      {idx === 0 ? 'Entrada: ' : ''}{item.wordBefore}
                    </span>
                    <span className="hist-arrow">{item.ruleApplied ? '→' : ''}</span>
                    <span className="hist-rule" title={ruleText}>{ruleText}</span>
                    <span className={`hist-status ${
                      item.status === 'terminal' ? 'terminal' : 
                      item.status === 'no_match' ? 'no-match' : ''
                    }`}>
                      {item.status === 'start' && 'Palavra Inicial'}
                      {item.status === 'normal' && 'Reescrita'}
                      {item.status === 'terminal' && 'Regra Terminal'}
                      {item.status === 'no_match' && 'Fim (Sem Match)'}
                      {item.status === 'limit_reached' && 'Parado por segurança'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </section>

      </main>

      {/* Painel Didático Inferior */}
      <footer className="glass-card educational-card" style={{ marginTop: '10px' }}>
        <div className="edu-tabs">
          <button 
            onClick={() => setActiveTab('presentation')}
            className={`tab-btn ${activeTab === 'presentation' ? 'active' : ''}`}
          >
            📋 O Exemplo da Apresentação
          </button>
          <button 
            onClick={() => setActiveTab('concept')}
            className={`tab-btn ${activeTab === 'concept' ? 'active' : ''}`}
          >
            📖 O que é o Algoritmo?
          </button>
          <button 
            onClick={() => setActiveTab('execution')}
            className={`tab-btn ${activeTab === 'execution' ? 'active' : ''}`}
          >
            ⚙️ Regras de Execução
          </button>
          <button 
            onClick={() => setActiveTab('turing')}
            className={`tab-btn ${activeTab === 'turing' ? 'active' : ''}`}
          >
            🧠 Chomsky e Turing-Completude
          </button>
        </div>

        <div className="edu-content">
          {activeTab === 'presentation' && (
            <div>
              <h3>Comparativo da Apresentação ({initialWord === 'aabb' ? 'aabb' : 'Entrada Atual'})</h3>
              <p>
                Na sua apresentação escrita, vocês detalharam o seguinte exemplo:
              </p>
              <div className="code-box">
Alfabeto: &lbrace;a, b&rbrace;
Regras Ordenadas:
1. ab → ba
2. aa → a
3. bb → b
Palavra Inicial: aabb
              </div>
              <p>
                <strong>Diferença de Execução (Computação Formal vs. Derivação Manual):</strong>
              </p>
              <ul>
                <li>
                  <strong>Execução Determinística do ANM (Leftmost Match):</strong> 
                  O algoritmo percorre a palavra da esquerda para a direita. No estado <code>abab</code>, 
                  existem dois padrões <code>ab</code> (índice 0 e índice 2). O Algoritmo Normal de Markov é 
                  rigorosamente definido para substituir a ocorrência <strong>mais à esquerda</strong>. 
                  Portanto, <code>abab</code> torna-se <code>baab</code> (passo 2) e depois <code>bbaa</code> (passo 3). 
                  O algoritmo conclui em <strong>5 passos</strong>: 
                  <code style={{ background: 'var(--bg-main)', padding: '2px 6px', borderRadius: '4px' }}>aabb → abab → baab → bbaa → bba → ba</code>.
                </li>
                <li>
                  <strong>Trace Manual da Apresentação:</strong> 
                  Na computação livre efetuada por humanos, escolheu-se comutar primeiro o segundo <code>ab</code> em <code>abab</code>, 
                  gerando <code>abba</code>, para depois comutar o primeiro <code>ab</code>, resultando em <code>baba</code> e depois <code>bbaa</code>. 
                  Isso resulta em um caminho de <strong>7 passos</strong>: 
                  <code style={{ background: 'var(--bg-main)', padding: '2px 6px', borderRadius: '4px' }}>aabb → abab → abba → baba → bbaa → bba → ba</code>.
                </li>
              </ul>
              <p>
                <em>Essa diferença é perfeita para explicar em aula!</em> Ela ilustra claramente a diferença entre um 
                sistema de reescrita semi-Thue geral (onde qualquer regra pode ser aplicada em qualquer local, de forma não determinística) 
                e o <strong>Algoritmo Normal de Markov</strong>, que impõe uma ordem estrita (de cima para baixo na lista de regras, 
                e da esquerda para a direita na string) para se tornar um algoritmo determinístico e mecânico.
              </p>
            </div>
          )}

          {activeTab === 'concept' && (
            <div>
              <h3>O que é o Algoritmo Normal de Markov (ANM)?</h3>
              <p>
                Inventado pelo matemático soviético Andrey Markov Jr. em 1950, o <strong>Algoritmo Normal de Markov</strong> é 
                um sistema de substituição de strings (reescrita de palavras) que serve como modelo formal de computação. 
                Ao contrário de autômatos que utilizam estados explícitos (como Autômatos Finitos ou de Pilha), o ANM realiza 
                toda a sua computação puramente por manipulação simbólica de textos.
              </p>
              <p>
                Ele é considerado um modelo de computação de <strong>Tipo 0</strong> na Hierarquia de Chomsky (Gramáticas Irrestritas), 
                sendo formalmente equivalente a Máquinas de Turing. Qualquer programa de computador ou algoritmo computável pode 
                ser codificado utilizando apenas substituições de Markov.
              </p>
            </div>
          )}

          {activeTab === 'execution' && (
            <div>
              <h3>Regras e Ordem de Execução</h3>
              <p>
                Para rodar o algoritmo de forma mecânica sobre uma palavra inicial $W$, repete-se o ciclo:
              </p>
              <ol>
                <li>
                  <strong>Varredura de Regras:</strong> Varre-se a lista de regras ordenadamente do topo ($Rule_1$) para baixo ($Rule_n$).
                </li>
                <li>
                  <strong>Casamento Leftmost:</strong> Para a primeira regra $L \to R$ que casar com a palavra $W$, localiza-se a 
                  ocorrência <em>mais à esquerda</em> da substring $L$ em $W$.
                </li>
                <li>
                  <strong>Substituição:</strong> Substitui-se essa ocorrência por $R$.
                </li>
                <li>
                  <strong>Fluxo de Controle:</strong> 
                  <ul>
                    <li>Se a regra aplicada era <strong>terminal</strong> (representada por um ponto $L \to .R$), o algoritmo <strong>para imediatamente</strong>.</li>
                    <li>Se a regra for comum, o ciclo <strong>reinicia inteiramente</strong> a partir da primeira regra da lista ($Rule_1$) usando a nova palavra.</li>
                  </ul>
                </li>
                <li>
                  <strong>Critério de Parada:</strong> Se nenhuma regra casar em parte alguma da palavra, a computação finaliza com sucesso.
                </li>
              </ol>
            </div>
          )}

          {activeTab === 'turing' && (
            <div>
              <h3>Relação com Gramáticas de Chomsky e Máquinas de Turing</h3>
              <p>
                Na matéria de <strong>Linguagens Formais e Autômatos</strong>, estudamos diferentes poderes computacionais. 
                O Algoritmo de Markov possui equivalência com a <strong>Máquina de Turing</strong>.
              </p>
              <p>
                Isso significa que, embora pareça simples (apenas substituição de substrings), o ANM é <strong>Turing-completo</strong>. 
                Com regras bem desenhadas, ele consegue emular:
              </p>
              <ul>
                <li>Variáveis e Cabeças de Leitura (usando marcadores como <code>p</code>, <code>X</code>, <code>|</code>).</li>
                <li>Estruturas de decisão (seletores).</li>
                <li>Laços de repetição (loops por meio de reescritas sucessivas recursivas).</li>
                <li>Operações aritméticas completas (multiplicação, soma, divisão).</li>
              </ul>
              <p>
                Isso prova que a computação não requer necessariamente chips ou registradores físicos: ela pode ocorrer de maneira 
                completamente abstrata por meio da manipulação estruturada de símbolos!
              </p>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
