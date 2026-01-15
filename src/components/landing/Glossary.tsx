import { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  category: string;
}

const glossaryTerms: GlossaryTerm[] = [
  {
    id: '1',
    term: 'Registro Definitivo',
    definition: 'Documento oficial emitido pela associação que comprova a propriedade definitiva de um animal, após o registro provisório e confirmação de todas as informações.',
    category: 'Documentação',
  },
  {
    id: '2',
    term: 'Registro Provisório',
    definition: 'Registro temporário de um animal recém-nascido, que será substituído pelo registro definitivo após confirmação de todas as informações e documentações necessárias.',
    category: 'Documentação',
  },
  {
    id: '3',
    term: 'Transferência de Propriedade',
    definition: 'Processo de mudança de titularidade de um animal, realizado junto à associação quando há compra, venda ou doação.',
    category: 'Documentação',
  },
  {
    id: '4',
    term: 'Comunicado de Prenhez',
    definition: 'Notificação obrigatória enviada à associação informando que uma égua está prenha, dentro do prazo estipulado pela associação.',
    category: 'Obrigações',
  },
  {
    id: '5',
    term: 'Comunicado de Nascimento',
    definition: 'Notificação obrigatória enviada à associação informando o nascimento de um potro, dentro do prazo estipulado (geralmente 30 dias após o nascimento).',
    category: 'Obrigações',
  },
  {
    id: '6',
    term: 'Chip de Identificação',
    definition: 'Dispositivo eletrônico implantado no animal que contém um número único de identificação, usado para rastreamento e controle.',
    category: 'Identificação',
  },
  {
    id: '7',
    term: 'Condomínio de Animais',
    definition: 'Acordo onde duas ou mais pessoas são proprietárias de um mesmo animal, com participações definidas.',
    category: 'Documentação',
  },
  {
    id: '8',
    term: 'Serviço de Campo',
    definition: 'Visita técnica realizada por um veterinário credenciado pela associação para inseminação, coleta de material genético, ou outros procedimentos técnicos.',
    category: 'Serviços',
  },
  {
    id: '9',
    term: 'Plantel',
    definition: 'Conjunto total de animais de um criatório, incluindo machos, fêmeas e potros.',
    category: 'Gestão',
  },
  {
    id: '10',
    term: 'ABCCC',
    definition: 'Associação Brasileira de Criadores de Cavalos Crioulos - principal associação da raça Crioula no Brasil.',
    category: 'Associações',
  },
  {
    id: '11',
    term: 'ABQM',
    definition: 'Associação Brasileira de Criadores do Cavalo Quarto de Milha - principal associação da raça Quarto de Milha no Brasil.',
    category: 'Associações',
  },
  {
    id: '12',
    term: 'Multa por Atraso',
    definition: 'Penalidade financeira aplicada pela associação quando prazos obrigatórios não são cumpridos, como comunicados de nascimento ou prenhez fora do prazo.',
    category: 'Obrigações',
  },
  {
    id: '13',
    term: 'Inscrição em Copa',
    definition: 'Registro de participação de um animal em competições ou eventos organizados pela associação.',
    category: 'Eventos',
  },
  {
    id: '14',
    term: 'Exposição',
    definition: 'Evento onde animais são avaliados e classificados por juízes, podendo receber títulos e premiações.',
    category: 'Eventos',
  },
  {
    id: '15',
    term: 'Embrião',
    definition: 'Óvulo fertilizado que pode ser transferido para uma égua receptora, permitindo que uma égua gere potros de outra.',
    category: 'Reprodução',
  },
];

const categories = ['Todos', 'Documentação', 'Obrigações', 'Identificação', 'Serviços', 'Gestão', 'Associações', 'Eventos', 'Reprodução'];

export default function Glossary() {
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTerms = glossaryTerms.filter((term) => {
    const matchesCategory = selectedCategory === 'Todos' || term.category === selectedCategory;
    const matchesSearch = term.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         term.definition.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <section id="glossario" className="py-16 md:py-24 bg-gradient-to-b from-white via-brand-off-white to-white reveal" data-reveal>
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <div className="mb-4 md:mb-6 flex justify-center">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-brand-brown to-brand-olive rounded-full flex items-center justify-center shadow-soft-lg animate-scale-in">
                <BookOpen className="w-8 h-8 md:w-10 md:h-10 text-white" strokeWidth={1.5} />
              </div>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-brand-beige/40 text-xs md:text-sm uppercase tracking-[0.2em] text-brand-dark-brown/70 mb-4">
              Glossário do Criador
            </span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-brand-brown mb-4">
              Entenda os Termos Técnicos
            </h2>
            <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-brand-olive to-transparent mx-auto mb-4 decorative-line" />
            <p className="text-brand-dark-brown/70 text-base md:text-lg max-w-2xl mx-auto">
              Dicionário completo com os principais termos do universo da criação de cavalos
            </p>
          </div>

          {/* Busca e Filtros */}
          <div className="mb-8 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-brown/40" />
              <input
                type="text"
                placeholder="Buscar termo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-brand-beige/40 bg-white focus:border-brand-olive focus:outline-none transition-colors shadow-soft"
              />
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    selectedCategory === category
                      ? 'bg-brand-olive text-white shadow-soft-lg'
                      : 'bg-white text-brand-brown border border-brand-beige/60 hover:bg-brand-beige/30 hover:border-brand-olive/60'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Termos */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            {filteredTerms.map((term, index) => (
              <div
                key={term.id}
                className="bg-white rounded-xl p-5 md:p-6 border border-brand-beige/60 shadow-soft depth-effect card-transition hover-lift glass-effect animate-scale-in"
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-brown to-brand-olive flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-white" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-display text-lg md:text-xl font-semibold text-brand-brown">
                        {term.term}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-brand-beige/40 text-xs font-medium text-brand-brown">
                        {term.category}
                      </span>
                    </div>
                    <p className="text-sm md:text-base text-brand-dark-brown/80 leading-relaxed">
                      {term.definition}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredTerms.length === 0 && (
            <div className="text-center py-12">
              <p className="text-brand-dark-brown/60 text-base md:text-lg">
                Nenhum termo encontrado. Tente outra busca ou categoria.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

