
# Escape Room da Matéria — Online V3

Jogo multiplayer em tempo real para aulas de Ciências.

## O que esta versão já faz
- Professor cria uma sala com código.
- Alunos entram pelo código usando nome.
- Vários alunos podem jogar simultaneamente.
- Ranking e pontuação são atualizados em tempo real.
- 20 desafios + 3 desafios do CHEFÃO FINAL.
- 90 segundos por desafio.
- 3 vidas por participante.
- XP/pontuação com bônus por rapidez.
- Fase 4 corrigida: a questão sobre componentes usa a alternativa "2".
- Professor possui painel para acompanhar a turma e avançar o desafio.
- Funciona em celular, tablet e computador.

## Rodar no computador
1. Instale Node.js 18 ou superior.
2. Abra o Prompt de Comando dentro desta pasta.
3. Execute:
   npm install
   npm start
4. Abra no navegador:
   http://localhost:3000

### Testar com vários jogadores no mesmo computador
Abra a página em várias abas/janelas. Todas entram na mesma sala usando o mesmo código.

## Colocar na internet
Este projeto precisa ser publicado em um servidor que aceite Node.js e WebSocket.
Depois de publicado, o professor terá um link único, por exemplo:
https://seu-jogo.exemplo.com

O código da sala continua sendo criado pelo servidor e os alunos entram pelo mesmo link.

## Observação
As salas ficam em memória enquanto o servidor está funcionando. Isso é intencional para uso em aula: ao reiniciar o servidor, as salas antigas são encerradas.
