-- Modelo padrão: Animal 100% com comissões (verso)
-- Execute após migration-modelos-contrato.sql

SET NAMES utf8mb4;

UPDATE contract_templates SET is_default = 0 WHERE is_default = 1;

DELETE FROM contract_templates WHERE code = 'ANIMAL_100_COMISSOES';

INSERT INTO contract_templates (name, code, title, body_text, is_default, active, notes)
VALUES (
  'Animal 100% com comissões (ambas as partes)',
  'ANIMAL_100_COMISSOES',
  'NOTA DE LEILÃO E CONTRATO COM RESERVA DE DOMÍNIO',
  'Pelo presente instrumento particular de COMPRA E VENDA COM RESERVA DE DOMÍNIO, as partes acima qualificadas ajustam e firmam o presente contrato, que se regerá pelas cláusulas e condições a seguir:

CLÁUSULA 1ª - DO OBJETO DO CONTRATO
1.1. O presente contrato tem como objeto a compra e venda de 100% (cem por cento) do bem, cuja especificação consta na “ESPECIFICAÇÃO DO LOTE”, regularmente registrado na Associação Brasileira dos Criadores de Mangalarga Marchador (ABCCMM).
1.2. O VENDEDOR declara ser legítimo proprietário e possuidor do semovente objeto deste contrato, garantindo que o animal encontra-se livre e desembaraçado de quaisquer ônus, dívidas ou restrições judiciais.
1.3. Reserva de Domínio:
a) A propriedade do animal permanecerá com o VENDEDOR até a quitação total do valor devido pelo COMPRADOR.
b) Durante esse período, o COMPRADOR manterá a posse direta do animal na condição de responsável direto por sua guarda, saúde, alimentação e manutenção.
c) O COMPRADOR não poderá vender, onerar ou transferir o animal adquirido sem autorização expressa do VENDEDOR.
1.4. Retirada do Animal: Após notificação sobre a disponibilidade do animal e a conclusão dos exames, o COMPRADOR terá o prazo de 30 (trinta) dias para promover a retirada do animal. Ultrapassado esse prazo, será cobrada pelo VENDEDOR diária de R$ 50,00 (cinquenta reais) até a efetiva retirada.
Parágrafo Primeiro: Permanecendo o animal no estabelecimento do VENDEDOR por período superior a 60 (sessenta) dias contados da disponibilização para retirada, sem justificativa aceita pelo VENDEDOR e sem a quitação integral das obrigações contratuais, ficará caracterizado o abandono contratual do bem pelo COMPRADOR.
Parágrafo Segundo: Nessa hipótese, o VENDEDOR poderá, mediante prévia notificação ao COMPRADOR por e-mail, WhatsApp ou outro meio idôneo, considerar rescindido o presente contrato e promover nova venda do animal a terceiros, independentemente de autorização do COMPRADOR, sem prejuízo da cobrança das parcelas vencidas, multa contratual, diárias de permanência, comissão da leiloeira e demais encargos previstos neste instrumento.
Parágrafo Terceiro: Os valores eventualmente recebidos pelo VENDEDOR poderão ser retidos para compensação das despesas de manutenção, guarda, alimentação, transporte, multas e demais débitos decorrentes do presente contrato.
1.5. O VENDEDOR declara que o animal objeto deste contrato está saindo do Haras em perfeito estado de saúde, devidamente examinado por profissional habilitado, livre de doença ou quaisquer condições que comprometam sua integridade física e bem-estar.
1.6. O COMPRADOR poderá submeter o animal ao “teste de compra” que será realizado por médico veterinário de sua escolha, para avaliação de suas condições físicas, visando avaliar as condições de saúde do animal.
1.7. O laudo comprobatório do teste de compra deverá ser apresentado no prazo de 30 (trinta) dias, contados da data de chegada do animal na propriedade do COMPRADOR.

CLÁUSULA 2ª - DO PREÇO E FORMAS DE PAGAMENTO
2.1. O COMPRADOR pagará ao VENDEDOR o valor especificado na composição financeira deste contrato, referente à aquisição do animal.
2.2. Primeira parcela: deverá ser quitada à vista, no dia seguinte ao leilão, com tolerância máxima de 05 (cinco) dias corridos, por meio de boleto ou depósito bancário emitido pela LEILOEIRA. O não pagamento da primeira parcela importará em rescisão automática do contrato e aplicação do disposto na cláusula 4.1.
2.3. Parcelas subsequentes: serão mensais, fixas e com vencimento a cada 30 (trinta) dias. A forma de pagamento da comissão da LEILOEIRA seguirá o regulamento específico de cada leilão, e contrato de prestação de serviços, podendo ocorrer: (i) nas primeiras parcelas do contrato, hipótese em que o VENDEDOR passará a receber somente a partir da parcela subsequente; ou (ii) apenas ao final, mediante emissão de boleto de cobrança no fechamento da negociação. O não recebimento do boleto não desobriga o pagamento na data do vencimento.
2.4. O comprador emitirá Nota Promissória única, vinculada ao presente contrato, em garantia do cumprimento das obrigações assumidas. Em caso de inadimplemento, o vendedor poderá promover sua cobrança judicial, sem prejuízo das demais medidas previstas neste contrato e na legislação aplicável.

CLÁUSULA 3ª – DA COMISSÃO DA LEILOEIRA
3.1. A LEILOEIRA fará jus, em qualquer hipótese, à comissão de 17% (dezessete por cento) sobre o valor total do lote, sendo:
a) 8,5% (oito e meio por cento) de responsabilidade do COMPRADOR, devidos no ato do pagamento da primeira parcela;
b) 8,5% (oito e meio por cento) de responsabilidade do VENDEDOR, satisfeitos mediante o recebimento direto das três primeiras parcelas do contrato pela LEILOEIRA.
3.2. A comissão constitui remuneração pelos serviços de intermediação e realização do leilão, sendo devida independentemente da efetiva conclusão do negócio, da entrega do animal, do pagamento integral das parcelas ou da eventual rescisão contratual, amigável ou judicial, por qualquer motivo.
3.3. A comissão da LEILOEIRA não será restituída em nenhuma hipótese, ainda que o contrato venha a ser rescindido, desfeito ou anulado, por desistência, inadimplemento, vício oculto ou qualquer outra causa.
3.4. Em caso de inadimplência do COMPRADOR na primeira parcela, ficará este responsável pelo pagamento integral da comissão de 17% (dezessete por cento), sem prejuízo das demais penalidades previstas neste contrato, ficando o VENDEDOR dispensado de qualquer obrigação de pagamento à LEILOEIRA.
3.5. Esta cláusula, assim como as Notas Promissórias emitidas, constituem título executivo extrajudicial, nos termos do art. 784, III, do Código de Processo Civil.

CLÁUSULA 4ª – DA INADIMPLÊNCIA E RESCISÃO
4.1. O não pagamento de qualquer parcela subsequente na data do vencimento resultará em:
a) juros moratórios de 1% (um por cento) ao mês;
b) correção monetária pelo índice IPCA.
4.2. O atraso superior a 30 (trinta) dias autoriza o protesto do débito e a inscrição do nome do COMPRADOR nos órgãos de proteção ao crédito, além da cobrança judicial, independentemente de nova notificação.
4.3. Rescisão por inadimplência ou desistência do COMPRADOR:
a) aplicação de multa compensatória de 20% (vinte por cento) sobre o valor total do contrato, além das penalidades incidentes sobre parcelas em atraso;
b) nenhuma quantia paga será devolvida ao COMPRADOR;
c) a comissão da LEILOEIRA permanecerá integralmente devida;
d) o COMPRADOR arcará integralmente com os custos de devolução, transporte e vistoria do animal;
e) se o animal devolvido estiver prenhe ou tiver gerado crias, estes permanecerão de propriedade do VENDEDOR.
4.4. Rescisão por desistência do VENDEDOR:
a) o VENDEDOR poderá desistir do presente contrato, por motivo relevante e justificado, mediante comunicação escrita ao COMPRADOR no prazo máximo de 15 (quinze) dias contados da assinatura, obrigando-se a restituir integralmente os valores recebidos, atualizados pelo IPCA;
b) nesta hipótese, a comissão da LEILOEIRA permanecerá devida, por já ter sido prestado o serviço de intermediação;
c) caso a desistência ocorra após a entrega do animal ou após a imissão do COMPRADOR na posse, o VENDEDOR responderá também pelas despesas comprovadamente realizadas com transporte, manutenção e cuidados essenciais até a efetiva devolução;
d) a desistência imotivada após o prazo acima acarretará responsabilidade do VENDEDOR por perdas e danos, limitados ao valor efetivamente pago pelo COMPRADOR, corrigido monetariamente.
4.5. Se o COMPRADOR tiver pago menos de 20% (vinte por cento) do valor do animal, deverá complementar esse montante em caso de devolução.
4.6. Retomada judicial do animal em caso de inadimplência: A propriedade do animal permanece com o VENDEDOR até a quitação integral do preço (arts. 521 e 525 do Código Civil). Em caso de inadimplência superior a 30 (trinta) dias, o VENDEDOR poderá ajuizar ação de execução, busca e apreensão ou reivindicatória, para retomada imediata do semovente, sendo o COMPRADOR responsável por todas as despesas decorrentes, sem prejuízo da cobrança das parcelas vencidas, multa, juros e demais penalidades previstas neste contrato.
4.7. Rescisão extrajudicial por inadimplência: Permanecendo o COMPRADOR inadimplente após o prazo de 30 (trinta) dias, o VENDEDOR poderá rescindir de imediato o contrato, mediante simples notificação encaminhada ao COMPRADOR por e-mail e/ou WhatsApp informados no cadastro inicial da venda. Nessa hipótese, o VENDEDOR poderá reter os valores já pagos e retomar a posse do animal, sem prejuízo da cobrança das parcelas vencidas, multa, juros e demais encargos previstos neste contrato.
4.8. O inadimplemento de qualquer obrigação assumida neste contrato, especialmente o atraso no pagamento de 01 (uma) parcela por prazo superior a 05 (cinco) dias corridos, ou o atraso de 02 (duas) parcelas, consecutivas ou não, importará, de pleno direito e independentemente de notificação judicial ou extrajudicial, no vencimento antecipado de todas as parcelas vincendas, tornando-se imediatamente exigível a integralidade do débito.

CLÁUSULA 5ª – DA TRANSFERÊNCIA DA DOCUMENTAÇÃO
5.1. A transferência da documentação do animal junto à Associação Brasileira dos Criadores do Cavalo Mangalarga Marchador (ABCCMM) e quaisquer demais registros oficiais somente será realizada pelo VENDEDOR após a quitação integral do valor estipulado neste contrato, inclusive em caso de antecipação parcial de parcelas.
5.2. Até que se verifique a quitação total, o VENDEDOR permanecerá como único proprietário registral do animal, independentemente da posse exercida pelo COMPRADOR.
5.3. A tentativa de exigir ou registrar transferência antes da quitação integral será considerada infração contratual grave, sujeita às penalidades previstas neste instrumento.

CLÁUSULA 6ª - DISPOSIÇÕES GERAIS
6.1. As partes declaram ter pleno conhecimento e aceitação do regulamento e do catálogo do leilão, os quais integram este contrato.
6.2. O contrato obriga as partes e seus sucessores ao seu cumprimento integral.
6.3. Caso haja qualquer litígio decorrente deste contrato, as partes elegem o foro da comarca de domicílio do VENDEDOR para dirimir questões relativas à compra e venda. Todavia, a LEILOEIRA poderá, a seu critério, ajuizar a cobrança de sua comissão no foro de seu próprio domicílio.
6.4. Exclusão do Código de Defesa do Consumidor: As partes reconhecem que este contrato tem natureza estritamente civil/comercial, não se caracterizando como relação de consumo. Assim, não se aplicam as disposições do Código de Defesa do Consumidor (Lei nº 8.078/90), salvo decisão judicial em contrário.
6.5. Em caso de cobrança judicial ou extrajudicial, o COMPRADOR inadimplente arcará, além das penalidades previstas, com honorários advocatícios convencionados de 20% (vinte por cento) sobre o débito atualizado, sem prejuízo das custas processuais.

Por estarem justos e contratados, firmam o presente instrumento em duas vias de igual teor.',
  1,
  1,
  'Modelo padrão — venda 100% com comissão da leiloeira nas duas partes (8,5% + 8,5%)'
);
