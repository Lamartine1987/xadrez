export function calculateElo(playerElo, opponentElo, result) {
    const K = 32;
    const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    let actualScore = 0;
    
    if (result === 'win') actualScore = 1;
    else if (result === 'draw') actualScore = 0.5;
    // if 'loss', actualScore is 0
    
    return Math.round(playerElo + K * (actualScore - expectedScore));
}
