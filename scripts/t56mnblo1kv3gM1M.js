return args.skill?.name.includes(`${game.i18n.localize("NAME.Melee")} (${game.i18n.localize("SPEC.Basic")})`) || (args.type == "weapon" && args.item?.system.weaponGroup.value == "basic");