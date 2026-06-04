import { PrismaClient } from '@prisma/client';
import { calculatePlayerPrice, calculateTeamPrice, calculateTeamStrengthIndex } from '../lib/scoring';

const prisma = new PrismaClient();

const teamsData = [
  { name: 'Argentina', code: 'ARG', rank: 1, continent: 'South America', flag: 'https://flagcdn.com/w320/ar.png', players: ['Lionel Messi', 'Angel Di Maria', 'Emiliano Martinez', 'Enzo Fernandez', 'Julian Alvarez', 'Alexis Mac Allister', 'Cristian Romero', 'Nicolas Otamendi', 'Lautaro Martinez', 'Rodrigo De Paul'] },
  { name: 'France', code: 'FRA', rank: 2, continent: 'Europe', flag: 'https://flagcdn.com/w320/fr.png', players: ['Kylian Mbappe', 'Antoine Griezmann', 'Aurelien Tchouameni', 'Ousmane Dembele', 'Eduardo Camavinga', 'William Saliba', 'Theo Hernandez', 'Mike Maignan', 'Dayot Upamecano', 'Adrien Rabiot'] },
  { name: 'Brazil', code: 'BRA', rank: 5, continent: 'South America', flag: 'https://flagcdn.com/w320/br.png', players: ['Vinicius Junior', 'Rodrygo', 'Alisson Becker', 'Bruno Guimaraes', 'Lucas Paqueta', 'Marquinhos', 'Eder Militao', 'Gabriel Martinelli', 'Endrick', 'Raphinha'] },
  { name: 'England', code: 'ENG', rank: 3, continent: 'Europe', flag: 'https://flagcdn.com/w320/gb-eng.png', players: ['Jude Bellingham', 'Harry Kane', 'Phil Foden', 'Bukayo Saka', 'Declan Rice', 'Kyle Walker', 'John Stones', 'Trent Alexander-Arnold', 'Cole Palmer', 'Jordan Pickford'] },
  { name: 'Spain', code: 'ESP', rank: 8, continent: 'Europe', flag: 'https://flagcdn.com/w320/es.png', players: ['Rodri', 'Lamine Yamal', 'Pedri', 'Gavi', 'Dani Olmo', 'Alvaro Morata', 'Aymeric Laporte', 'Unai Simon', 'Dani Carvajal', 'Nico Williams'] },
  { name: 'Germany', code: 'GER', rank: 16, continent: 'Europe', flag: 'https://flagcdn.com/w320/de.png', players: ['Jamal Musiala', 'Florian Wirtz', 'Joshua Kimmich', 'Leroy Sane', 'Antonio Rudiger', 'Manuel Neuer', 'Kai Havertz', 'Ilkay Gundogan', 'Jonathan Tah', 'Niclas Fullkrug'] },
  { name: 'Portugal', code: 'POR', rank: 6, continent: 'Europe', flag: 'https://flagcdn.com/w320/pt.png', players: ['Cristiano Ronaldo', 'Bruno Fernandes', 'Bernardo Silva', 'Ruben Dias', 'Rafael Leao', 'Joao Cancelo', 'Diogo Jota', 'Joao Felix', 'Vitinha', 'Pepe'] },
  { name: 'Italy', code: 'ITA', rank: 9, continent: 'Europe', flag: 'https://flagcdn.com/w320/it.png', players: ['Nicolo Barella', 'Federico Chiesa', 'Gianluigi Donnarumma', 'Alessandro Bastoni', 'Federico Dimarco', 'Lorenzo Pellegrini', 'Giacomo Raspadori', 'Jorginho', 'Ciro Immobile', 'Matteo Darmian'] },
  { name: 'Netherlands', code: 'NED', rank: 7, continent: 'Europe', flag: 'https://flagcdn.com/w320/nl.png', players: ['Virgil van Dijk', 'Frenkie de Jong', 'Cody Gakpo', 'Xavi Simons', 'Matthijs de Ligt', 'Denzel Dumfries', 'Nathan Ake', 'Memphis Depay', 'Jeremie Frimpong', 'Bart Verbruggen'] },
  { name: 'Belgium', code: 'BEL', rank: 4, continent: 'Europe', flag: 'https://flagcdn.com/w320/be.png', players: ['Kevin De Bruyne', 'Romelu Lukaku', 'Jeremy Doku', 'Amadou Onana', 'Leandro Trossard', 'Jan Vertonghen', 'Wout Faes', 'Youri Tielemans', 'Timothy Castagne', 'Koen Casteels'] },
  { name: 'Uruguay', code: 'URU', rank: 11, continent: 'South America', flag: 'https://flagcdn.com/w320/uy.png', players: ['Federico Valverde', 'Darwin Nunez', 'Ronald Araujo', 'Rodrigo Bentancur', 'Manuel Ugarte', 'Jose Gimenez', 'Facundo Pellistri', 'Nicolas de la Cruz', 'Sergio Rochet', 'Mathias Olivera'] },
  { name: 'Colombia', code: 'COL', rank: 14, continent: 'South America', flag: 'https://flagcdn.com/w320/co.png', players: ['Luis Diaz', 'James Rodriguez', 'Jefferson Lerma', 'Davinson Sanchez', 'Camilo Vargas', 'Jhon Arias', 'Richard Rios', 'Daniel Munoz', 'Johan Mojica', 'Rafael Santos Borre'] },
  { name: 'Croatia', code: 'CRO', rank: 10, continent: 'Europe', flag: 'https://flagcdn.com/w320/hr.png', players: ['Luka Modric', 'Josko Gvardiol', 'Mateo Kovacic', 'Marcelo Brozovic', 'Andrej Kramaric', 'Dominik Livakovic', 'Mario Pasalic', 'Lovro Majer', 'Borna Sosa', 'Josip Sutalo'] },
  { name: 'Morocco', code: 'MAR', rank: 12, continent: 'Africa', flag: 'https://flagcdn.com/w320/ma.png', players: ['Achraf Hakimi', 'Hakim Ziyech', 'Yassine Bounou', 'Sofyan Amrabat', 'Brahim Diaz', 'Nayef Aguerd', 'Romain Saiss', 'Youssef En-Nesyri', 'Amine Adli', 'Azzedine Ounahi'] },
  { name: 'Senegal', code: 'SEN', rank: 17, continent: 'Africa', flag: 'https://flagcdn.com/w320/sn.png', players: ['Sadio Mane', 'Kalidou Koulibaly', 'Edouard Mendy', 'Ismaila Sarr', 'Pape Matar Sarr', 'Idrissa Gueye', 'Nicolas Jackson', 'Moussa Niakhate', 'Krepin Diatta', 'Lamine Camara'] }
];

const positions = ['GK', 'DEF', 'MID', 'FWD'];
const dummyAvatar = 'https://ui-avatars.com/api/?background=random&color=fff&name=';

async function main() {
  console.log('🚀 Starting Full Offline Data Seed (No API Required)...');

  for (const team of teamsData) {
    console.log(`\n--- Seeding ${team.name} ---`);
    
    const processedPlayers = team.players.map((playerName, index) => {
      // First player is usually the biggest star, others vary
      const isStar = index < 2;
      const tier = isStar ? 0.9 : 0.6 + (Math.random() * 0.2); // 0.6 to 0.8
      const age = Math.floor(Math.random() * (35 - 19 + 1)) + 19;
      
      let pos = 'MID';
      if (index === 2) pos = 'GK';
      else if (index > 5 && index < 9) pos = 'DEF';
      else if (index <= 1 || index === 9) pos = 'FWD';

      let baseValue = isStar ? 80 : 25;
      if (age < 25) baseValue *= 1.2;
      if (age > 32) baseValue *= 0.6;
      baseValue *= tier;
      
      const globalMarketValue = Math.round(baseValue);
      
      const assetObj = {
        type: 'PLAYER' as const,
        playerTier: tier,
        globalMarketValue,
        age,
        popularity: isStar ? 0.95 : 0.6 + (Math.random() * 0.3),
      };
      
      const price = calculatePlayerPrice(assetObj);
      const score = Math.round(70 + (tier * 20));
      
      return {
        id: `player-${team.code.toLowerCase()}-${index}`,
        name: playerName,
        age,
        pos,
        number: index === 2 ? 1 : Math.floor(Math.random() * 99) + 2,
        photo: `${dummyAvatar}${encodeURIComponent(playerName)}`,
        tier,
        price,
        score,
        ...assetObj
      };
    });

    const teamPartial = { 
      type: 'TEAM' as const, 
      fifaRank: team.rank, 
      participations: 5 + Math.floor(Math.random() * 10), 
      popularity: 0.7 + (Math.random() * 0.2), 
      harmony: 0.8 + (Math.random() * 0.15), 
      injuries: 0 
    };
    
    const teamPrice = calculateTeamPrice(teamPartial, processedPlayers.map(p => ({ current_price: p.price })));
    const teamScore = calculateTeamStrengthIndex(teamPartial, processedPlayers.map(p => ({ score: p.score })));

    const dbTeamId = `team-${team.code.toLowerCase()}`;
    
    // Save Team
    const savedTeam = await prisma.asset.upsert({
      where: { id: dbTeamId },
      update: {
        current_price: teamPrice,
        score: teamScore,
        fifaRank: team.rank,
      },
      create: {
        id: dbTeamId,
        type: 'TEAM',
        name: team.name,
        code: team.code,
        image: team.flag,
        current_price: teamPrice,
        high_price: teamPrice,
        low_price: teamPrice,
        market_cap: '1B',
        volume: '10M',
        change: 0,
        fifaRank: team.rank,
        score: teamScore,
        continent: team.continent,
        group: 'A',
        participations: teamPartial.participations,
        ownersCount: Math.floor(Math.random() * 5000) + 1000,
        riskIndex: 0.5,
        priceHistory: { create: { price: teamPrice } }
      }
    });

    // Save Players
    for (const p of processedPlayers) {
      await prisma.asset.upsert({
        where: { id: p.id },
        update: {
          current_price: p.price,
          age: p.age,
          position: p.pos,
        },
        create: {
          id: p.id,
          type: 'PLAYER',
          name: p.name,
          code: `${team.code.substring(0,2).toUpperCase()}${p.number}`,
          image: p.photo,
          teamId: savedTeam.id,
          current_price: p.price,
          high_price: p.price,
          low_price: p.price,
          market_cap: '10M',
          volume: '100K',
          change: 0,
          position: p.pos,
          score: p.score,
          playerTier: p.tier,
          age: p.age,
          globalMarketValue: p.globalMarketValue,
          priceHistory: { create: { price: p.price } }
        }
      });
    }

    console.log(`✅ Saved ${team.name} and ${processedPlayers.length} players!`);
  }

  console.log('\n🎉 Local Data Seed Completed Successfully! Your market is full! 🏆');
}

main()
  .catch(e => {
    console.error('Fatal Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
