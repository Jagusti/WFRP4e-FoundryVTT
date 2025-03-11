import TestWFRP from "../../system/rolls/test-wfrp4e";
import WFRP_Utility from "../../system/utility-wfrp4e";

export class WFRPTestMessageModel extends WarhammerTestMessageModel 
{
    get test() 
    {
        return TestWFRP.recreate(this.testData)   
    }

    static get actions() 
    { 
        return foundry.utils.mergeObject(super.actions, {
            overcastClick : this.onOvercastClick,
            overcastReset : this.onOvercastReset,
            moveVortex : this.onMoveVortex
        });
    }

    get canEdit()
    {
      let msg = this.parent
      return msg.isOwner || msg.isAuthor;
    }

    static get contextMenuOptions()
    {
        let test = this.test;
        if (!test)
        {
            return [];
        }
        return  [
        {
          name: game.i18n.localize("CHATOPT.UseFortuneReroll"),
          icon: '<i class="fas fa-dice"></i>',
          condition: test.actor.isOwner && test.actor.status.fortune?.value > 0 && test.failed && !test.fortuneUsed.reroll,
          callback: li => {
            let message = game.messages.get(li.attr("data-message-id"));
            let test = message.system.test;
            test.useFortune("reroll");
          }
        },
        {
          name: game.i18n.localize("CHATOPT.Reroll"),
          icon: '<i class="fas fa-dice"></i>',
          condition: game.user.isGM,
          callback: li => {
            let message = game.messages.get(li.attr("data-message-id"));
            let test = message.system.test;
            test.reroll();
          }
        },
        {
          name: game.i18n.localize("CHATOPT.UseFortuneSL"),
          icon: '<i class="fas fa-plus-square"></i>',
          condition: test.actor.isOwner && test.actor.status.fortune?.value > 0 && !test.fortuneUsed.SL,
          callback: li => {
            let message = game.messages.get(li.attr("data-message-id"));
            let test = message.system.test;
            test.useFortune("addSL");
          }
        },
        {
          name: game.i18n.localize("CHATOPT.DarkDeal"),
          icon: '<i class="fas fa-pen-nib"></i>',
          condition: test.actor.isOwner && test.actor.type == "character",
          callback: li => {
            let message = game.messages.get(li.attr("data-message-id"));
            let test = message.system.test;
            test.useDarkDeal();
          }
        },
        {
          name: game.i18n.localize("CHATOPT.OpposeTarget"),
          icon: '<i class="fas fa-crosshairs"></i>',
          condition: test.actor.isOwner,
          callback: li => {
            let message = game.messages.get(li.attr("data-message-id"));
            let test = message.system.test;
            let targets = Array.from(game.user.targets).map(t => t.actor.speakerData(t.document))
            if (canvas.scene) { 
              game.user.updateTokenTargets([]);
              game.user.broadcastActivity({targets: []});
            }
  
            test.context.targets = test.context.targets.concat(targets)
            targets.map(t => WFRP_Utility.getToken(t)).forEach(t => {
              test.createOpposedMessage(t)
            })
          }
        },
        {
          name: game.i18n.localize("CHATOPT.CompleteUnopposed"),
          icon: '<i class="fas fa-angle-double-down"></i>',
          condition: test.actor.isOwner && test.opposedMessages.length >= 2,
          callback: li => {
  
            let message = game.messages.get(li.attr("data-message-id"));
            let test = message.system.test;
            test.opposedMessages.forEach(message => {
              if (message)
              {
                let oppose = message.system.opposedHandler;
                oppose.resolveUnopposed();
              }
            })
          }
        },
        {
          name: game.i18n.localize("CHATOPT.ApplyAllDamage"),
          icon: '<i class="fas fa-user-minus"></i>',
          condition: test.opposedMessages.length >= 2 && test.opposedMessages.some(m => m?.system.opposedHandler?.resultMessage),
          callback: li => {
            let message = game.messages.get(li.attr("data-message-id"));
            let test = message.system.test;
            for (let message of test.opposedMessages) {
              if (message) {
                let opposedTest = message.system.opposedHandler;
                if (!opposedTest.defenderTest.actor.isOwner) {
                  ui.notifications.error(game.i18n.localize("ErrorDamagePermission"))
                } else {
                  opposedTest.defender.applyDamage(opposedTest.resultMessage.system.opposedTest, game.wfrp4e.config.DAMAGE_TYPE.NORMAL)
                    .then(updateMsg => OpposedHandler.updateOpposedMessage(updateMsg, opposedTest.resultMessage.id));
                }
              }
            }
          }
        },
        {
          name: game.i18n.localize("CHATOPT.TotalPower"),
          icon: '<i class="fa-solid fa-bolt"></i>',
          condition: (message.isOwner || message.isAuthor) && test instanceof CastTest && test.result.critical && game.settings.get("wfrp4e", "useWoMOvercast") && !test.result.totalPower,
          callback: li => {
            let message = game.messages.get(li.attr("data-message-id"));
            let test = message.system.test;
            test.preData.totalPower = true;
            test.roll();
          }
        }
    ]
    }
  static async onPlaceAreaEffect(event) {
    if (!this.canEdit)
      return ui.notifications.error("CHAT.EditError")
    
    let effectUuid = event.currentTarget.dataset.uuid;
    let test = this.test
    let radius;
    if (test?.result.overcast?.usage.target)
    {
      radius = test.result.overcast.usage.target.current;

      if (test.spell)
      {
        radius /= 2; // Spells define their diameter, not radius
      }
    }

    let effect = await fromUuid(effectUuid)
    let effectData = effect.convertToApplied(test);
    if (!(await effect.runPreApplyScript({effectData})))
    {
        return;
    }
    let template = await AreaTemplate.fromEffect(effectUuid, messageId, radius, foundry.utils.diffObject(effectData, effect.convertToApplied(test)));
    await template.drawPreview(event);
  }
  
      // Respond to overcast button clicks
  static onOvercastClick(event) {
    event.preventDefault();
    let msg = this.parent
    if (!this.canEdit)
      return ui.notifications.error("CHAT.EditError")

    let test = msg.system.test
    let overcastChoice = event.currentTarget.dataset.overcast;
    // Set overcast and rerender card
    test._overcast(overcastChoice)
    
    //@HOUSE
    if (game.settings.get("wfrp4e", "mooOvercasting"))
    {
      game.wfrp4e.utility.logHomebrew("mooOvercasting")
    }
    //@/HOUSE

    
  }

  // Button to reset the overcasts
  static onOvercastReset(event) {
    event.preventDefault();
    let msg = this.parent
    if (!this.canEdit)
      return ui.notifications.error("CHAT.EditError")

    let test = this.test
    // Reset overcast and rerender card
    test._overcastReset()
        
    //@HOUSE
    if (game.settings.get("wfrp4e", "mooOvercasting"))
    {
      game.wfrp4e.utility.logHomebrew("mooOvercasting")
    }
    //@/HOUSE
  }

  static onMoveVortex(event)
  {
    let msg = this.parent;
    if (!this.canEdit)
      return ui.notifications.error("CHAT.EditError")
    let test = this.test
    test.moveVortex();
  }

}