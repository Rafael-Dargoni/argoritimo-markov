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
      return <div className="w-[100px] xs:w-[120px] h-8 xs:h-[42px] border border-dashed border-slate-700 rounded flex items-center justify-center text-xs text-slate-500 font-sans">Palavra Vazia (ε)</div>;
    }

    const chars = currentWord.split('');
    const match = currentMatch;

    return (
      <div className="flex flex-wrap gap-1 justify-center items-center w-full">
        {chars.map((char, idx) => {
          let isCharMatched = false;
          if (match) {
            isCharMatched = idx >= match.start && idx < match.start + match.length;
          }

          return (
            <div
              key={idx}
              className={`w-7 h-8 xs:w-9 xs:h-[42px] bg-slate-800 border rounded flex items-center justify-center font-mono text-base xs:text-lg font-bold shadow-sm transition-all duration-205 ${
                isCharMatched 
                  ? 'bg-amber-950/70 border-amber-500 text-amber-500 -translate-y-0.5 pulse-glow' 
                  : 'border-slate-700 text-slate-100'
              }`}
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
      <div className="flex flex-col items-center gap-1 w-full animate-[slideDown_0.2s_ease-out]">
        <div className="text-amber-500 text-xl leading-none">↓</div>
        <div className="flex gap-1 justify-center">
          {replacementPart.split('').map((char, idx) => (
            <div key={idx} className="w-7 h-8 xs:w-9 xs:h-[42px] bg-emerald-950/70 border border-emerald-500 text-emerald-500 rounded flex items-center justify-center font-mono text-base xs:text-lg font-bold shadow-sm">
              {char}
            </div>
          ))}
          {replacementPart === '' && (
            <div className="w-7 h-8 xs:w-9 xs:h-[42px] bg-emerald-950/70 border border-emerald-500 text-emerald-500 rounded flex items-center justify-center font-mono text-xs font-bold border-dashed">
              ε
            </div>
          )}
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
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
    <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-5 text-slate-100 font-sans">
      {/* Cabeçalho */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-700 pb-4 mb-2 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-400 tracking-tight">Simulador de Algoritmo Normal de Markov</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">Linguagens Formais, Autômatos e Reescrita de Símbolos</p>
        </div>
        <div className="flex gap-2">
          <span className="text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded border border-blue-900 bg-blue-950/40 text-blue-400 uppercase tracking-wider">Turing Completo</span>
          <span className="text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded border border-slate-700 bg-slate-800 text-slate-100 uppercase tracking-wider">Teoria de Computação</span>
        </div>
      </header>

      {/* Grid Principal */}
      <main className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-5">
        
        {/* Coluna Esquerda: Presets & Editor de Regras */}
        <section className="flex flex-col gap-5">
                    {/* Editor de Regras */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 shadow-md hover:shadow-lg transition-shadow duration-200 flex-grow">
            <h2 className="text-sm font-bold mb-4 text-slate-100 flex justify-between items-center uppercase tracking-widest border-b border-slate-700 pb-2">
              <span>Lista de Regras</span>
              <button 
                onClick={handleClearAllRules}
                className="bg-rose-950/30 border border-rose-500/50 text-rose-400 rounded cursor-pointer text-[10px] font-bold px-2 py-1 transition-colors hover:bg-rose-600 hover:text-white hover:border-rose-600"
                title="Limpar todas as regras"
              >
                Limpar Todas
              </button>
            </h2>

            <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1 mb-4">
              {rules.map((rule, index) => {
                const isCurrentStepRule = currentMatch && currentMatch.ruleIndex === index;
                
                return (
                  <div 
                    key={rule.id} 
                    className={`flex items-center gap-2 p-2 bg-slate-900 border rounded-lg transition-all duration-150 flex-wrap sm:flex-nowrap relative ${
                      isCurrentStepRule 
                        ? (status.startsWith('halted_terminal') ? 'border-emerald-500 bg-emerald-500/10' : 'border-blue-500 bg-blue-500/10')
                        : 'border-slate-700'
                    }`}
                  >
                    <div className="font-mono text-xs font-bold text-slate-500 w-[18px] text-center">{index + 1}</div>
                    
                    <input
                      type="text"
                      value={rule.lhs}
                      onChange={(e) => handleUpdateRuleField(index, 'lhs', e.target.value)}
                      placeholder="padrão"
                      className="bg-slate-800 border border-slate-700 text-slate-100 font-mono text-xs px-2 py-1 rounded w-[42%] sm:w-[90px] text-center focus:outline-none focus:border-blue-500 flex-grow sm:flex-grow-0"
                      title="Lado Esquerdo: substring a ser buscada"
                    />
                    
                    <span className="font-mono text-sm text-slate-300 font-bold w-12 text-center">
                      {rule.isTerminal ? '→ .' : '→'}
                    </span>
                    
                    <input
                      type="text"
                      value={rule.rhs}
                      onChange={(e) => handleUpdateRuleField(index, 'rhs', e.target.value)}
                      placeholder="substituir"
                      className="bg-slate-800 border border-slate-700 text-slate-100 font-mono text-xs px-2 py-1 rounded w-[42%] sm:w-[90px] text-center focus:outline-none focus:border-blue-500 flex-grow sm:flex-grow-0"
                      title="Lado Direito: string que substituirá a original"
                    />

                    <button
                      onClick={() => handleToggleTerminal(index)}
                      className={`border rounded px-2 py-1 text-[10px] font-bold cursor-pointer transition-colors w-auto flex-grow sm:flex-grow-0 ${
                        rule.isTerminal 
                          ? 'bg-rose-950/40 text-rose-400 border-rose-500 hover:bg-rose-900/40' 
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                      }`}
                      title={rule.isTerminal ? "Regra Terminal (Para a máquina após aplicar)" : "Tornar Regra Terminal"}
                    >
                      Terminal
                    </button>

                    <div className="flex gap-1 ml-auto w-full sm:w-auto justify-end border-t border-slate-800 sm:border-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
                      <button
                        onClick={() => handleMoveRuleUp(index)}
                        disabled={index === 0}
                        className="bg-slate-800 border border-slate-700 text-slate-400 w-7 h-7 sm:w-6 sm:h-6 rounded cursor-pointer flex items-center justify-center text-xs sm:text-[10px] transition-colors hover:bg-slate-750 hover:text-slate-100 hover:border-slate-500 disabled:opacity-50"
                        title="Subir prioridade da regra"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveRuleDown(index)}
                        disabled={index === rules.length - 1}
                        className="bg-slate-800 border border-slate-700 text-slate-400 w-7 h-7 sm:w-6 sm:h-6 rounded cursor-pointer flex items-center justify-center text-xs sm:text-[10px] transition-colors hover:bg-slate-750 hover:text-slate-100 hover:border-slate-500 disabled:opacity-50"
                        title="Descer prioridade da regra"
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => handleRemoveRule(index)}
                        className="bg-slate-800 border border-slate-700 text-slate-400 w-7 h-7 sm:w-6 sm:h-6 rounded cursor-pointer flex items-center justify-center text-xs sm:text-[10px] transition-colors hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-500"
                        title="Excluir regra"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {rules.length === 0 && (
                <div className="text-center padding-8 text-slate-500 text-sm">
                  Nenhuma regra cadastrada. Adicione regras abaixo para começar.
                </div>
              )}
            </div>

            <button 
              onClick={handleAddRule} 
              className="w-full bg-slate-800 border border-dashed border-slate-700 text-slate-300 rounded-lg p-2.5 cursor-pointer font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 hover:border-blue-500 hover:text-blue-400 hover:bg-slate-750"
            >
              ➕ Adicionar Nova Regra
            </button>
          </div>

          
          {/* Seção de Presets */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow duration-200">
            <h2 className="text-sm font-bold mb-4 text-slate-100 flex justify-between items-center uppercase tracking-widest border-b border-slate-700 pb-2">
              <span>Presets Didáticos</span>
              <span className="text-[10px] font-normal text-slate-400 lowercase">
                Selecione para carregar
              </span>
            </h2>
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectPreset(idx)}
                  className={`w-full border rounded-lg p-2.5 text-left cursor-pointer transition-all duration-150 flex flex-col gap-0.5 hover:bg-slate-750 hover:border-blue-500 ${
                    idx === selectedPresetIndex 
                      ? 'bg-blue-950/40 border-blue-500' 
                      : 'bg-slate-900 border-slate-700 text-slate-100'
                  }`}
                >
                  <span className="font-bold text-xs text-blue-400">{preset.name}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">{preset.description}</span>
                </button>
              ))}
            </div>
            {presets[selectedPresetIndex]?.academicNote && (
              <div className="mt-3 p-2.5 bg-blue-950/20 border-l-4 border-blue-600 rounded-r-lg text-[11px] leading-relaxed text-slate-300">
                <strong>Nota Acadêmica:</strong> {presets[selectedPresetIndex].academicNote}
              </div>
            )}
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow duration-200">
            <h2 className="text-sm font-bold mb-4 text-slate-100 flex justify-between items-center uppercase tracking-widest border-b border-slate-700 pb-2">Membros da Equipe</h2>
            <div className="flex flex-col gap-1.5">
              <div className="text-xs font-semibold text-slate-300 px-3 py-2 bg-slate-900 border border-slate-700 rounded tracking-wide">RAFAEL ANTONIO SCHIRNER DARGONI</div>
              <div className="text-xs font-semibold text-slate-300 px-3 py-2 bg-slate-900 border border-slate-700 rounded tracking-wide">THIAGO FONSECA RODRIGUES MARTINS</div>
              <div className="text-xs font-semibold text-slate-300 px-3 py-2 bg-slate-900 border border-slate-700 rounded tracking-wide">VINICIUS AUGUSTO CORREA LEITE</div>
              <div className="text-xs font-semibold text-slate-300 px-3 py-2 bg-slate-900 border border-slate-700 rounded tracking-wide">VINICIUS COTRIM AZZI</div>
            </div>
          </div>

        </section>

        {/* Coluna Direita: Visualizador, Controles, Histórico */}
        <section className="flex flex-col gap-5">
          
          {/* Cartão do Visualizador */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow duration-200">
            
            {/* Input de String */}
            <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
              <div className="flex-grow relative">
                <span className="absolute -top-2 left-2.5 bg-slate-800 px-1 text-[9px] font-bold uppercase text-blue-500 tracking-wider">Palavra de Entrada Inicial</span>
                <input
                  type="text"
                  value={initialWord}
                  onChange={(e) => handleWordInputChange(e.target.value)}
                  placeholder="Ex: aabb, 111+11"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 px-3.5 text-slate-100 font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <button 
                onClick={() => resetSimulation()} 
                className="bg-slate-800 border border-slate-700 text-slate-100 font-sans text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-slate-750 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Resetar palavra para o estado inicial"
              >
                🔄 Reiniciar
              </button>
            </div>

            {/* Quadro de Visualização de Reescrita */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 min-h-[180px] flex flex-col justify-center items-center gap-4 relative overflow-hidden mb-5">
              <div className="text-[9px] text-slate-500 absolute top-2.5 left-3.5 uppercase font-bold tracking-wider">
                Painel Visualizador de String
              </div>
              
              {/* String de Entrada / Atual */}
              {renderStringBlocks()}

              {/* Substituição ocorrendo */}
              {renderMatchOverlay()}

              {/* Informações inferiores do estado */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0 w-full pt-2.5 border-t border-dashed border-slate-700 text-xs">
                <div>
                  <span className="font-semibold text-slate-300">
                    Status: <strong className={
                      status.startsWith('halted_terminal') ? 'text-emerald-450' :
                      status.startsWith('halted_no_match') ? 'text-amber-500' :
                      status.startsWith('halted_limit') ? 'text-rose-500' : ''
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
                  Regra Aplicada: <code className="text-[11px] px-1.5 py-0.5 rounded bg-slate-950 font-mono text-blue-400">{getActiveRuleDescription()}</code>
                </div>
                <div className="font-mono font-bold text-blue-400">
                  Passo: {stepCount} / {activeHistoryIndex} no Histórico
                </div>
              </div>
            </div>

            {/* Controle da Simulação */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
              <div className="grid grid-cols-2 xs:flex gap-2 w-full md:w-auto">
                <button
                  onClick={handleStepBackward}
                  disabled={activeHistoryIndex === 0}
                  className="inline-flex items-center justify-center gap-1.5 font-sans text-xs font-bold px-4 py-2.5 rounded-lg border border-slate-700 cursor-pointer transition-all duration-150 select-none bg-slate-800 text-slate-100 hover:bg-slate-750 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed w-full xs:w-auto"
                  title="Voltar um passo na história (Undo)"
                >
                  ⏮️ Voltar
                </button>

                <button
                  onClick={() => setRunning(!running)}
                  disabled={status.startsWith('halted')}
                  className={`inline-flex items-center justify-center gap-1.5 font-sans text-xs font-bold px-4 py-2.5 rounded-lg border cursor-pointer transition-all duration-150 select-none w-full xs:w-auto ${
                    running 
                      ? 'bg-rose-950/30 border-rose-500/50 text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600' 
                      : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-500 hover:border-blue-500'
                  }`}
                  title={running ? "Pausar auto-execução" : "Executar simulação automaticamente"}
                >
                  {running ? '⏸️ Pausar' : '▶️ Auto Simular'}
                </button>

                <button
                  onClick={handleStepForward}
                  disabled={status.startsWith('halted')}
                  className="inline-flex items-center justify-center gap-1.5 font-sans text-xs font-bold px-4 py-2.5 rounded-lg border border-slate-700 cursor-pointer transition-all duration-150 select-none bg-slate-800 text-slate-100 hover:bg-slate-750 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed w-full xs:w-auto"
                  title="Avançar exatamente um passo"
                >
                  ⏭️ Avançar
                </button>

                <button
                  onClick={handleRunToEnd}
                  disabled={status.startsWith('halted')}
                  className="inline-flex items-center justify-center gap-1.5 font-sans text-xs font-bold px-4 py-2.5 rounded-lg border cursor-pointer transition-all duration-150 select-none bg-slate-750 border-slate-700 text-slate-100 hover:bg-slate-700 hover:border-slate-500 w-full xs:w-auto"
                  title="Executar todo o algoritmo de uma vez"
                >
                  🚀 Executar Tudo
                </button>
              </div>

              {/* Slider de Velocidade */}
              <div className="flex items-center justify-between md:justify-start gap-2.5 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg w-full md:w-auto">
                <span className="text-[10px] font-bold uppercase text-slate-400 whitespace-nowrap">Velocidade:</span>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full md:w-[100px] h-1 rounded-sm bg-slate-700 accent-blue-500 outline-none cursor-pointer"
                />
                <span className="font-mono text-xs font-bold text-blue-400 w-12 text-right">{speed}ms</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 leading-relaxed">
              💡 <strong>Rastreamento:</strong> {statusMessage}
            </div>

          </div>

          {/* Histórico de Transições */}
          <div className="bg-slate-800 border border-slate-700 min-h-[250px] rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow duration-200 mt-2">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-widest border-b border-slate-700 pb-2 flex-grow" style={{ marginBottom: 0 }}>Histórico de Execução</h2>
              <span className="text-[11px] text-slate-400">
                {history.length} estados
              </span>
            </div>
            
            <div className="flex flex-col gap-1.5 max-h-[530px] overflow-y-auto pr-1">
              {history.map((item, idx) => {
                const isActive = idx === activeHistoryIndex;
                const ruleText = item.ruleApplied 
                  ? `${item.ruleApplied.lhs || 'ε'} → ${item.ruleApplied.isTerminal ? '.' : ''}${item.ruleApplied.rhs || 'ε'}`
                  : '';
                
                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectHistoryItem(idx)}
                    className={`grid grid-cols-[50px_1fr_20px_1fr] sm:grid-cols-[60px_1.5fr_30px_1.5fr_1.2fr] items-center p-2 sm:px-3 sm:py-2 border rounded-lg text-xs transition-colors cursor-pointer ${
                      isActive 
                        ? 'border-blue-500 bg-blue-500/10' 
                        : 'border-slate-700 bg-slate-800 hover:bg-slate-750'
                    }`}
                    title="Clique para inspecionar este estado"
                  >
                    <span className="font-mono font-bold text-slate-500">Passo {item.step}</span>
                    <span className="font-mono truncate pr-1" title={item.wordBefore}>
                      {idx === 0 ? 'Entrada: ' : ''}{item.wordBefore}
                    </span>
                    <span className="text-slate-500 text-center">{item.ruleApplied ? '→' : ''}</span>
                    <span className="font-mono font-bold text-blue-400 truncate pr-1" title={ruleText}>{ruleText}</span>
                    <span className={`text-[10px] font-semibold text-right col-span-4 sm:col-span-1 sm:text-right border-t border-dashed border-slate-700/50 sm:border-0 pt-1.5 sm:pt-0 mt-1 sm:mt-0 ${
                      item.status === 'terminal' ? 'text-rose-450' : 
                      item.status === 'no_match' ? 'text-slate-500' : 'text-slate-300'
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
      <footer className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow duration-200 mt-2">
        <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 border-b-2 border-slate-700 pb-2 mb-3">
          <button 
            onClick={() => setActiveTab('presentation')}
            className={`bg-none border-b-2 font-bold text-xs sm:text-sm cursor-pointer px-2 py-1 relative transition-colors ${
              activeTab === 'presentation' 
                ? 'text-blue-400 border-blue-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📋 O Exemplo da Apresentação
          </button>
          <button 
            onClick={() => setActiveTab('concept')}
            className={`bg-none border-b-2 font-bold text-xs sm:text-sm cursor-pointer px-2 py-1 relative transition-colors ${
              activeTab === 'concept' 
                ? 'text-blue-400 border-blue-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📖 O que é o Algoritmo?
          </button>
          <button 
            onClick={() => setActiveTab('execution')}
            className={`bg-none border-b-2 font-bold text-xs sm:text-sm cursor-pointer px-2 py-1 relative transition-colors ${
              activeTab === 'execution' 
                ? 'text-blue-400 border-blue-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚙️ Regras de Execução
          </button>
          <button 
            onClick={() => setActiveTab('turing')}
            className={`bg-none border-b-2 font-bold text-xs sm:text-sm cursor-pointer px-2 py-1 relative transition-colors ${
              activeTab === 'turing' 
                ? 'text-blue-400 border-blue-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🧠 Chomsky e Turing-Completude
          </button>
        </div>

        <div className="leading-relaxed text-xs sm:text-sm text-slate-300">
          {activeTab === 'presentation' && (
            <div>
              <h3 className="text-sm font-bold text-slate-100 mt-4 mb-2">Comparativo da Apresentação ({initialWord === 'aabb' ? 'aabb' : 'Entrada Atual'})</h3>
              <p>
                Na sua apresentação escrita, vocês detalharam o seguinte exemplo:
              </p>
              <div className="bg-slate-900 border border-slate-700 rounded p-2 sm:p-3 font-mono text-xs text-slate-100 my-2 whitespace-pre-wrap break-all">
Alfabeto: &lbrace;a, b&rbrace;
Regras Ordenadas:
1. ab → ba
2. aa → a
3. bb → b
Palavra Inicial: aabb
              </div>
              <p className="mt-3">
                <strong>Diferença de Execução (Computação Formal vs. Derivação Manual):</strong>
              </p>
              <ul className="list-disc pl-5 my-2 flex flex-col gap-2">
                <li>
                  <strong>Execução Determinística do ANM (Leftmost Match):</strong> 
                  O algoritmo percorre a palavra da esquerda para a direita. No estado <code>abab</code>, 
                  existem dois padrões <code>ab</code> (índice 0 e índice 2). O Algoritmo Normal de Markov é 
                  rigorosamente definido para substituir a ocorrência <strong>mais à esquerda</strong>. 
                  Portanto, <code>abab</code> torna-se <code>baab</code> (passo 2) e depois <code>bbaa</code> (passo 3). 
                  O algoritmo conclui em <strong>5 passos</strong>: 
                  <code className="bg-slate-950 text-blue-450 px-1.5 py-0.5 rounded font-mono ml-1 text-xs">aabb → abab → baab → bbaa → bba → ba</code>.
                </li>
                <li>
                  <strong>Trace Manual da Apresentação:</strong> 
                  Na computação livre efetuada por humanos, escolheu-se comutar primeiro o segundo <code>ab</code> em <code>abab</code>, 
                  gerando <code>abba</code>, para depois comutar o primeiro <code>ab</code>, resultando em <code>baba</code> e depois <code>bbaa</code>. 
                  Isso resulta em um caminho de <strong>7 passos</strong>: 
                  <code className="bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded font-mono ml-1 text-xs">aabb → abab → abba → baba → bbaa → bba → ba</code>.
                </li>
              </ul>
              <p className="mt-3">
                <em>Essa diferença é perfeita para explicar em aula!</em> Ela ilustra claramente a diferença entre um 
                sistema de reescrita semi-Thue geral (onde qualquer regra pode ser aplicada em qualquer local, de forma não determinística) 
                e o <strong>Algoritmo Normal de Markov</strong>, que impõe uma ordem estrita (de cima para baixo na lista de regras, 
                e da esquerda para a direita na string) para se tornar um algoritmo determinístico e mecânico.
              </p>
            </div>
          )}

          {activeTab === 'concept' && (
            <div>
              <h3 className="text-sm font-bold text-slate-100 mt-4 mb-2">O que é o Algoritmo Normal de Markov (ANM)?</h3>
              <p>
                Inventado pelo matemático soviético Andrey Markov Jr. em 1950, o <strong>Algoritmo Normal de Markov</strong> é 
                um sistema de substituição de strings (reescrita de palavras) que serve como modelo formal de computação. 
                Ao contrário de autômatos que utilizam estados explícitos (como Autômatos Finitos ou de Pilha), o ANM realiza 
                toda a sua computação puramente por manipulação simbólica de textos.
              </p>
              <p className="mt-2">
                Ele é considerado um modelo de computação de <strong>Tipo 0</strong> na Hierarquia de Chomsky (Gramáticas Irrestritas), 
                sendo formalmente equivalente a Máquinas de Turing. Qualquer programa de computador ou algoritmo computável pode 
                ser codificado utilizando apenas substituições de Markov.
              </p>
            </div>
          )}

          {activeTab === 'execution' && (
            <div>
              <h3 className="text-sm font-bold text-slate-100 mt-4 mb-2">Regras e Ordem de Execução</h3>
              <p>
                Para rodar o algoritmo de forma mecânica sobre uma palavra inicial $W$, repete-se o ciclo:
              </p>
              <ol className="list-decimal pl-5 my-2 flex flex-col gap-1.5">
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
                  <ul className="list-disc pl-5 mt-1">
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
              <h3 className="text-sm font-bold text-slate-100 mt-4 mb-2">Relação com Gramáticas de Chomsky e Máquinas de Turing</h3>
              <p>
                Na matéria de <strong>Linguagens Formais e Autômatos</strong>, estudamos diferentes poderes computacionais. 
                O Algoritmo de Markov possui equivalência com a <strong>Máquina de Turing</strong>.
              </p>
              <p className="mt-2">
                Isso significa que, embora pareça simples (apenas substituição de substrings), o ANM é <strong>Turing-completo</strong>. 
                Com regras bem desenhadas, ele consegue emular:
              </p>
              <ul className="list-disc pl-5 my-2 flex flex-col gap-1.5">
                <li>Variáveis e Cabeças de Leitura (usando marcadores como <code>p</code>, <code>X</code>, <code>|</code>).</li>
                <li>Estruturas de decisão (seletores).</li>
                <li>Laços de repetição (loops por meio de reescritas sucessivas recursivas).</li>
                <li>Operações aritméticas completas (multiplicação, soma, divisão).</li>
              </ul>
              <p className="mt-2">
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
