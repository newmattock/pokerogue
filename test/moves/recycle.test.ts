import { BerryModifier } from "#app/modifier/modifier";
import { MoveResult } from "#app/field/pokemon";
import { Abilities } from "#enums/abilities";
import { BerryType } from "#enums/berry-type";
import { Moves } from "#enums/moves";
import { Species } from "#enums/species";
import GameManager from "#test/testUtils/gameManager";
import Phaser from "phaser";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("Moves - Recycle", () => {
  let phaserGame: Phaser.Game;
  let game: GameManager;

  beforeAll(() => {
    phaserGame = new Phaser.Game({
      type: Phaser.HEADLESS,
    });
  });

  afterEach(() => {
    game.phaseInterceptor.restoreOg();
  });

  beforeEach(() => {
    game = new GameManager(phaserGame);
    game.override
      .moveset([Moves.RECYCLE, Moves.SPLASH])
      .startingHeldItems([{ name: "BERRY", type: BerryType.SITRUS }])
      .battleStyle("single")
      .disableCrits()
      .enemySpecies(Species.MAGIKARP)
      .enemyAbility(Abilities.BALL_FETCH)
      .enemyMoveset(Moves.SPLASH);
  });

  const getPlayerBerries = () =>
    game.scene.getModifiers(BerryModifier, true).filter(b => b.pokemonId === game.scene.getPlayerPokemon()?.id);

  it("restores the user's last eaten berry", async () => {
    await game.classicMode.startBattle([Species.FEEBAS]);

    const player = game.scene.getPlayerPokemon()!;
    player.hp = 1;

    game.move.select(Moves.SPLASH);
    await game.forceEnemyMove(Moves.SPLASH);
    await game.phaseInterceptor.to("BerryPhase");
    expect(getPlayerBerries()).toHaveLength(0);
    expect(player.battleData.berriesEaten).toEqual([BerryType.SITRUS]);
    await game.phaseInterceptor.to("TurnEndPhase");

    game.move.select(Moves.RECYCLE);
    await game.forceEnemyMove(Moves.SPLASH);
    await game.phaseInterceptor.to("MoveEndPhase");

    const berries = getPlayerBerries();
    expect(berries).toHaveLength(1);
    expect(berries[0].berryType).toBe(BerryType.SITRUS);
    expect(player.battleData.berriesEaten).toEqual([]);
  });

  it("fails if the user already has an item", async () => {
    await game.classicMode.startBattle([Species.FEEBAS]);

    const player = game.scene.getPlayerPokemon()!;
    player.hp = 1;

    game.move.select(Moves.SPLASH);
    await game.forceEnemyMove(Moves.SPLASH);
    await game.phaseInterceptor.to("BerryPhase");
    await game.phaseInterceptor.to("TurnEndPhase");

    game.move.select(Moves.RECYCLE);
    await game.forceEnemyMove(Moves.SPLASH);
    await game.phaseInterceptor.to("MoveEndPhase");
    player.hp = player.stats.hp; // keep the berry uneaten on turn end
    await game.phaseInterceptor.to("TurnEndPhase");

    game.move.select(Moves.RECYCLE);
    await game.forceEnemyMove(Moves.SPLASH);
    await game.phaseInterceptor.to("MoveEndPhase");

    expect(player.getLastXMoves(1)[0].result).toBe(MoveResult.FAIL);
  });

  it("remembers consumed berries through switching", async () => {
    await game.classicMode.startBattle([Species.FEEBAS, Species.SHUCKLE]);

    const [feebas] = game.scene.getPlayerParty();
    feebas.hp = 1;

    game.move.select(Moves.SPLASH);
    await game.forceEnemyMove(Moves.SPLASH);
    await game.phaseInterceptor.to("BerryPhase");
    await game.phaseInterceptor.to("TurnEndPhase");

    game.doSwitchPokemon(1);
    await game.forceEnemyMove(Moves.SPLASH);
    await game.toNextTurn();

    game.doSwitchPokemon(1);
    await game.forceEnemyMove(Moves.SPLASH);
    await game.toNextTurn();

    game.move.select(Moves.RECYCLE);
    await game.forceEnemyMove(Moves.SPLASH);
    await game.phaseInterceptor.to("MoveEndPhase");

    expect(getPlayerBerries()).toHaveLength(1);
    expect(feebas.battleData.berriesEaten).toEqual([]);
  });
});
