import { X } from 'lucide-react';

interface PrivacyPolicyProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrivacyPolicy({ isOpen, onClose }: PrivacyPolicyProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-brand-brown to-brand-olive text-white p-6 flex items-center justify-between z-10">
          <h2 className="font-display text-2xl md:text-3xl font-bold">Política de Privacidade</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            aria-label="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 space-y-6 text-brand-dark-brown">
          <div>
            <p className="text-sm text-brand-dark-brown/70 mb-4">
              <strong>Última atualização:</strong> {new Date().toLocaleDateString('pt-BR')}
            </p>
            <p className="text-sm text-brand-dark-brown/70">
              A Ariane Andrade Inteligência Agropecuária Ltda ("nós", "nosso" ou "empresa") respeita sua privacidade e está comprometida em proteger seus dados pessoais. Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos suas informações pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
            </p>
          </div>

          <section>
            <h3 className="font-display text-xl font-bold text-brand-brown mb-3">1. Informações que Coletamos</h3>
            <p className="text-sm text-brand-dark-brown/80 mb-3">
              Coletamos as seguintes informações quando você utiliza nosso diagnóstico:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-brand-dark-brown/80 ml-4">
              <li><strong>Nome completo:</strong> Para personalização do diagnóstico e comunicação</li>
              <li><strong>Número de WhatsApp:</strong> Para envio do resultado do diagnóstico e contato sobre serviços</li>
              <li><strong>Respostas do diagnóstico:</strong> Para gerar o resultado personalizado</li>
              <li><strong>Dados de uso:</strong> Data e hora do diagnóstico, score e recomendações geradas</li>
            </ul>
          </section>

          <section>
            <h3 className="font-display text-xl font-bold text-brand-brown mb-3">2. Como Utilizamos suas Informações</h3>
            <p className="text-sm text-brand-dark-brown/80 mb-3">
              Utilizamos suas informações pessoais exclusivamente para:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-brand-dark-brown/80 ml-4">
              <li>Gerar e enviar o resultado personalizado do diagnóstico por WhatsApp</li>
              <li>Melhorar nossos serviços e experiência do usuário</li>
              <li>Entrar em contato sobre serviços de assessoria, caso você tenha interesse</li>
              <li>Manter registros para fins estatísticos e de melhoria contínua</li>
            </ul>
          </section>

          <section>
            <h3 className="font-display text-xl font-bold text-brand-brown mb-3">3. Armazenamento e Segurança</h3>
            <p className="text-sm text-brand-dark-brown/80 mb-3">
              Seus dados são armazenados de forma segura:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-brand-dark-brown/80 ml-4">
              <li>Utilizamos o Google Sheets (Google Drive) para armazenamento, que possui certificações de segurança internacionais</li>
              <li>Apenas pessoal autorizado tem acesso aos dados</li>
              <li>Implementamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, alteração, divulgação ou destruição</li>
            </ul>
          </section>

          <section>
            <h3 className="font-display text-xl font-bold text-brand-brown mb-3">4. Compartilhamento de Dados</h3>
            <p className="text-sm text-brand-dark-brown/80">
              <strong>Não compartilhamos, vendemos ou alugamos suas informações pessoais para terceiros.</strong> Seus dados são utilizados exclusivamente pela Ariane Andrade Assessoria para os fins descritos nesta política.
            </p>
          </section>

          <section>
            <h3 className="font-display text-xl font-bold text-brand-brown mb-3">5. Seus Direitos (LGPD)</h3>
            <p className="text-sm text-brand-dark-brown/80 mb-3">
              De acordo com a LGPD, você tem os seguintes direitos:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-brand-dark-brown/80 ml-4">
              <li><strong>Acesso:</strong> Solicitar informações sobre quais dados temos sobre você</li>
              <li><strong>Correção:</strong> Solicitar correção de dados incompletos ou desatualizados</li>
              <li><strong>Exclusão:</strong> Solicitar a exclusão de seus dados pessoais</li>
              <li><strong>Portabilidade:</strong> Solicitar a portabilidade dos seus dados</li>
              <li><strong>Revogação de consentimento:</strong> Retirar seu consentimento a qualquer momento</li>
            </ul>
            <p className="text-sm text-brand-dark-brown/80 mt-3">
              Para exercer seus direitos, entre em contato conosco através do e-mail: <a href="mailto:contato@arianeandradeassessoria.com.br" className="text-brand-olive hover:underline">contato@arianeandradeassessoria.com.br</a>
            </p>
          </section>

          <section>
            <h3 className="font-display text-xl font-bold text-brand-brown mb-3">6. Retenção de Dados</h3>
            <p className="text-sm text-brand-dark-brown/80">
              Mantemos seus dados pessoais apenas pelo tempo necessário para cumprir as finalidades descritas nesta política, a menos que um período de retenção mais longo seja exigido ou permitido por lei. Você pode solicitar a exclusão de seus dados a qualquer momento.
            </p>
          </section>

          <section>
            <h3 className="font-display text-xl font-bold text-brand-brown mb-3">7. Consentimento</h3>
            <p className="text-sm text-brand-dark-brown/80">
              Ao utilizar nosso diagnóstico e fornecer suas informações, você consente com a coleta, uso e armazenamento de seus dados conforme descrito nesta Política de Privacidade. Você pode retirar seu consentimento a qualquer momento entrando em contato conosco.
            </p>
          </section>

          <section>
            <h3 className="font-display text-xl font-bold text-brand-brown mb-3">8. Alterações nesta Política</h3>
            <p className="text-sm text-brand-dark-brown/80">
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você sobre quaisquer alterações significativas publicando a nova política nesta página e atualizando a data de "Última atualização".
            </p>
          </section>

          <section>
            <h3 className="font-display text-xl font-bold text-brand-brown mb-3">9. Contato</h3>
            <p className="text-sm text-brand-dark-brown/80 mb-2">
              Se você tiver dúvidas sobre esta Política de Privacidade ou sobre como tratamos seus dados pessoais, entre em contato:
            </p>
            <div className="text-sm text-brand-dark-brown/80 space-y-1">
              <p><strong>E-mail:</strong> <a href="mailto:contato@arianeandradeassessoria.com.br" className="text-brand-olive hover:underline">contato@arianeandradeassessoria.com.br</a></p>
              <p><strong>Telefone:</strong> <a href="tel:+5521999293866" className="text-brand-olive hover:underline">(21) 99929-3866</a></p>
              <p><strong>Endereço:</strong> Rua Campo Grande, nº 1014, SL 223, Passeio Empresarial, Campo Grande, Rio de Janeiro | RJ, CEP 23.080-000</p>
            </div>
          </section>

          <div className="pt-4 border-t border-brand-beige/40">
            <p className="text-xs text-brand-dark-brown/60 text-center">
              Esta política está em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

