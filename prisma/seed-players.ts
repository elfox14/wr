import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateHistory(basePrice: number) {
  const history = [];
  let currentPrice = basePrice;
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const change = (Math.random() - 0.45) * 5;
    currentPrice += change;
    const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    history.push({ price: Math.round(currentPrice), timestamp });
  }
  return history;
}

const morePlayers: Record<string, {name: string, code: string, price: number}[]> = {
  'ARG': [
    { name: 'Emiliano Martinez', code: 'EM23', price: 2500 },
    { name: 'Angel Di Maria', code: 'ADM11', price: 2200 },
    { name: 'Enzo Fernandez', code: 'EF8', price: 3100 },
    { name: 'Alexis Mac Allister', code: 'AMA20', price: 3000 },
    { name: 'Cristian Romero', code: 'CR13', price: 2100 }
  ],
  'FRA': [
    { name: 'Aurelien Tchouameni', code: 'AT8', price: 3200 },
    { name: 'Eduardo Camavinga', code: 'EC6', price: 3400 },
    { name: 'Ousmane Dembele', code: 'OD11', price: 2800 },
    { name: 'William Saliba', code: 'WS2', price: 2900 },
    { name: 'Theo Hernandez', code: 'TH22', price: 2600 }
  ],
  'BRA': [
    { name: 'Neymar Jr', code: 'NJR10', price: 4000 },
    { name: 'Alisson Becker', code: 'AB1', price: 2400 },
    { name: 'Lucas Paqueta', code: 'LP8', price: 2100 },
    { name: 'Marquinhos', code: 'M4', price: 2000 },
    { name: 'Endrick', code: 'E9', price: 3500 }
  ],
  'ENG': [
    { name: 'Phil Foden', code: 'PF11', price: 3900 },
    { name: 'Bukayo Saka', code: 'BS7', price: 3800 },
    { name: 'Declan Rice', code: 'DR4', price: 3100 },
    { name: 'John Stones', code: 'JS5', price: 2300 },
    { name: 'Jordan Pickford', code: 'JP1', price: 1800 }
  ],
  'ESP': [
    { name: 'Rodri', code: 'R16', price: 3500 },
    { name: 'Gavi', code: 'G9', price: 3200 },
    { name: 'Dani Olmo', code: 'DO10', price: 2700 },
    { name: 'Nico Williams', code: 'NW11', price: 3300 },
    { name: 'Aymeric Laporte', code: 'AL14', price: 2100 }
  ],
  'GER': [
    { name: 'Kai Havertz', code: 'KH7', price: 2900 },
    { name: 'Antonio Rüdiger', code: 'AR2', price: 2500 },
    { name: 'Leroy Sane', code: 'LS10', price: 2800 },
    { name: 'Joshua Kimmich', code: 'JK6', price: 2700 },
    { name: 'Marc-André ter Stegen', code: 'MTS1', price: 2200 }
  ],
  'POR': [
    { name: 'Bernardo Silva', code: 'BS10', price: 3200 },
    { name: 'Ruben Dias', code: 'RD3', price: 2900 },
    { name: 'Joao Felix', code: 'JF11', price: 2600 },
    { name: 'Rafael Leao', code: 'RL17', price: 3100 },
    { name: 'Diogo Jota', code: 'DJ21', price: 2700 }
  ],
  'ITA': [
    { name: 'Nicolo Barella', code: 'NB18', price: 3000 },
    { name: 'Gianluigi Donnarumma', code: 'GD1', price: 2600 },
    { name: 'Alessandro Bastoni', code: 'AB95', price: 2500 },
    { name: 'Federico Dimarco', code: 'FD3', price: 2400 },
    { name: 'Giacomo Raspadori', code: 'GR10', price: 2100 }
  ],
  'NED': [
    { name: 'Frenkie de Jong', code: 'FDJ21', price: 3100 },
    { name: 'Cody Gakpo', code: 'CG8', price: 2800 },
    { name: 'Xavi Simons', code: 'XS7', price: 3300 },
    { name: 'Matthijs de Ligt', code: 'MDL3', price: 2400 },
    { name: 'Nathan Ake', code: 'NA5', price: 2300 }
  ],
  'MAR': [
    { name: 'Hakim Ziyech', code: 'HZ7', price: 2400 },
    { name: 'Yassine Bounou', code: 'YB1', price: 2200 },
    { name: 'Sofyan Amrabat', code: 'SA4', price: 2100 },
    { name: 'Brahim Diaz', code: 'BD10', price: 2700 },
    { name: 'Youssef En-Nesyri', code: 'YEN19', price: 2300 }
  ],
  'KSA': [
    { name: 'Firas Al-Buraikan', code: 'FAB9', price: 1500 },
    { name: 'Mohamed Kanno', code: 'MK23', price: 1300 },
    { name: 'Saud Abdulhamid', code: 'SA12', price: 1600 },
    { name: 'Hassan Tambakti', code: 'HT17', price: 1400 },
    { name: 'Abdulrahman Ghareeb', code: 'AG29', price: 1500 }
  ],
  'EGY': [
    { name: 'Omar Marmoush', code: 'OM7', price: 2500 },
    { name: 'Mostafa Mohamed', code: 'MM11', price: 2100 },
    { name: 'Mahmoud Trezeguet', code: 'MT27', price: 1900 },
    { name: 'Ahmed Sayed Zizo', code: 'ASZ25', price: 1800 },
    { name: 'Mohamed El Shenawy', code: 'MES1', price: 1500 }
  ],
  'USA': [
    { name: 'Weston McKennie', code: 'WM8', price: 2200 },
    { name: 'Timothy Weah', code: 'TW21', price: 2100 },
    { name: 'Folarin Balogun', code: 'FB20', price: 2400 },
    { name: 'Tyler Adams', code: 'TA4', price: 2000 },
    { name: 'Matt Turner', code: 'MT1', price: 1600 }
  ]
};

async function main() {
  console.log('Adding additional national team players...');
  
  const allTeams = await prisma.asset.findMany({
    where: { type: 'TEAM' }
  });

  let count = 0;

  for (const team of allTeams) {
    const playersToAdd = morePlayers[team.code];
    if (!playersToAdd) continue;

    for (const p of playersToAdd) {
      const pId = `player-${team.code.toLowerCase()}-${p.code.toLowerCase()}`;
      
      const existing = await prisma.asset.findUnique({ where: { id: pId } });
      if (existing) continue;

      const pHistoryData = generateHistory(p.price);
      const pFinalPrice = pHistoryData[pHistoryData.length - 1].price;
      const pHighPrice = Math.max(...pHistoryData.map(h => h.price));
      const pLowPrice = Math.min(...pHistoryData.map(h => h.price));

      await prisma.asset.create({
        data: {
          id: pId,
          type: 'PLAYER',
          name: p.name,
          code: p.code,
          image: team.image, 
          teamId: team.id,
          current_price: pFinalPrice,
          high_price: pHighPrice,
          low_price: pLowPrice,
          market_cap: `${Math.floor(Math.random() * 500 + 50)}M`,
          volume: `${Math.floor(Math.random() * 5 + 1)}M`,
          change: parseFloat((Math.random() * 6 - 3).toFixed(2)),
          priceHistory: {
            create: pHistoryData.map(h => ({
              price: h.price,
              timestamp: h.timestamp
            }))
          }
        }
      });
      count++;
    }
  }

  console.log(`Successfully added ${count} new players to the database.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
