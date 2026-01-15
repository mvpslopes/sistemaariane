import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    id: '1',
    question: 'O que é uma assessoria ao criador?',
    answer: 'Uma assessoria ao criador é um serviço especializado que auxilia criadores de cavalos em todas as questões administrativas, burocráticas e organizacionais relacionadas à criação. Isso inclui gestão de registros, cumprimento de prazos junto às associações, organização de contratos, e muito mais.',
  },
  {
    id: '2',
    question: 'Quais são os principais benefícios de contratar uma assessoria?',
    answer: 'Os principais benefícios incluem: evitar multas por atraso de prazos, organização completa da documentação, economia de tempo, tranquilidade para focar na criação, e garantia de que todas as obrigações junto às associações estão em dia.',
  },
  {
    id: '3',
    question: 'Como funciona o processo de assessoria?',
    answer: 'O processo começa com uma análise da situação atual do criatório. Em seguida, organizamos todas as pendências, estabelecemos um planejamento e executamos todas as demandas junto às associações, mantendo você sempre informado sobre o andamento.',
  },
  {
    id: '4',
    question: 'Quanto tempo leva para regularizar pendências?',
    answer: 'O tempo varia conforme a quantidade e complexidade das pendências. Geralmente, questões simples são resolvidas em poucos dias, enquanto processos mais complexos podem levar algumas semanas. Sempre mantemos você informado sobre os prazos.',
  },
  {
    id: '5',
    question: 'A assessoria trabalha com todas as associações?',
    answer: 'Sim, trabalhamos com todas as principais associações de raças equinas do Brasil, incluindo ABCCC, ABQM, ABQMangalarga, e outras. Temos experiência e conhecimento específico de cada uma delas.',
  },
  {
    id: '6',
    question: 'Preciso estar presente durante o processo?',
    answer: 'Não necessariamente. A assessoria pode trabalhar de forma independente, mantendo você informado sobre o andamento. No entanto, para questões que exigem sua assinatura ou presença, combinamos a melhor forma de proceder.',
  },
  {
    id: '7',
    question: 'Como é feito o controle de prazos?',
    answer: 'Utilizamos um sistema completo de gestão que monitora todos os prazos importantes: nascimentos, prenhezes, registros, transferências, e demais obrigações. Você recebe alertas e acompanha tudo de forma organizada.',
  },
  {
    id: '8',
    question: 'A assessoria ajuda com compra e venda de animais?',
    answer: 'Sim, auxiliamos na organização de contratos de compra, venda e condomínios de animais, garantindo que toda a documentação esteja correta e que as transferências sejam feitas adequadamente junto às associações.',
  },
];

export default function FAQ() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <section id="faq" className="py-16 md:py-24 bg-gradient-to-b from-brand-off-white via-white to-brand-off-white reveal" data-reveal>
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <div className="mb-4 md:mb-6 flex justify-center">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-brand-brown to-brand-olive rounded-full flex items-center justify-center shadow-soft-lg animate-scale-in">
                <HelpCircle className="w-8 h-8 md:w-10 md:h-10 text-white" strokeWidth={1.5} />
              </div>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-brand-beige/40 text-xs md:text-sm uppercase tracking-[0.2em] text-brand-dark-brown/70 mb-4">
              Perguntas Frequentes
            </span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-brand-brown mb-4">
              Tire Suas Dúvidas
            </h2>
            <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-brand-olive to-transparent mx-auto mb-4 decorative-line" />
            <p className="text-brand-dark-brown/70 text-base md:text-lg max-w-2xl mx-auto">
              Respostas para as principais dúvidas sobre assessoria ao criador
            </p>
          </div>

          <div className="space-y-4">
            {faqItems.map((item, index) => {
              const isOpen = openItems.has(item.id);
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-brand-beige/60 shadow-soft depth-effect card-transition hover-lift glass-effect animate-scale-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="w-full text-left p-5 md:p-6 flex items-center justify-between gap-4 group"
                  >
                    <h3 className="font-display text-base md:text-lg font-semibold text-brand-brown flex-1 group-hover:text-brand-olive transition-colors">
                      {item.question}
                    </h3>
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-brand-beige/40 flex items-center justify-center transition-all duration-300 ${
                      isOpen ? 'bg-brand-olive text-white rotate-180' : 'group-hover:bg-brand-olive/20'
                    }`}>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5" strokeWidth={2} />
                      ) : (
                        <ChevronDown className="w-5 h-5" strokeWidth={2} />
                      )}
                    </div>
                  </button>
                  
                  <div className={`overflow-hidden transition-all duration-300 ${
                    isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}>
                    <div className="px-5 md:px-6 pb-5 md:pb-6 pt-0">
                      <p className="text-sm md:text-base text-brand-dark-brown/80 leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <p className="text-brand-dark-brown/70 text-sm md:text-base mb-4">
              Não encontrou a resposta que procurava?
            </p>
            <button
              onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-3 bg-brand-brown text-white rounded-full font-semibold hover:bg-brand-olive transition-all duration-300 shadow-soft-lg hover:shadow-soft-lg transform hover:-translate-y-1 hover:scale-105"
            >
              Entre em Contato
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

