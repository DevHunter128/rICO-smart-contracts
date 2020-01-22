const helpers = setup.helpers;
const BN = helpers.BN;
const MAX_UINT256 = helpers.MAX_UINT256;
const expect = helpers.expect

const holder = accounts[10];
const projectWalletAddress = holder;
const participant_1 = accounts[4];
const participant_2 = accounts[5];
const participant_3 = accounts[6];
const participant_4 = accounts[7];
const participant_5 = accounts[8];
const participant_6 = accounts[9];

const RicoSaleSupply = setup.settings.token.sale.toString();
const blocksPerDay = 6450;

const ApplicationEventTypes = {
    NOT_SET:0,        // will match default value of a mapping result
    CONTRIBUTION_NEW:1,
    CONTRIBUTION_CANCEL:2,
    PARTICIPANT_CANCEL:3,
    COMMITMENT_ACCEPTED:4,
    WHITELIST_APPROVE:5,
    WHITELIST_REJECT:6,
    PROJECT_WITHDRAW:7
}

const TransferTypes = {
    NOT_SET:0,
    AUTOMATIC_REFUND:1,
    WHITELIST_REJECT:2,
    PARTICIPANT_CANCEL:3,
    PARTICIPANT_WITHDRAW:4,
    PROJECT_WITHDRAW:5
}


let errorMessage;

describe("ReversibleICO", function () {

    const deployerAddress = accounts[0];
    const whitelistControllerAddress = accounts[1];
    let TokenContractAddress, stageValidation = [], currentBlock, commitPhaseStartBlock,
        commitPhaseBlockCount, commitPhasePrice, commitPhaseEndBlock, StageCount,
        StageBlockCount, StagePriceIncrease, BuyPhaseEndBlock;
    let TokenContractInstance;

    before(async function () {
        // test requires ERC1820.instance
        if (helpers.ERC1820.instance == false) {
            console.log("  Error: ERC1820.instance not found, please make sure to run it first.");
            process.exit();
        }

        // deploy mock contract so we can set block times. ( ReversibleICOMock )
        this.ReversibleICO = await helpers.utils.deployNewContractInstance(helpers, "ReversibleICOMock");

        console.log("      Gas used for deployment:", this.ReversibleICO.receipt.gasUsed);
        console.log("      Contract Address:", this.ReversibleICO.receipt.contractAddress);
        console.log("");

        helpers.addresses.Rico = this.ReversibleICO.receipt.contractAddress;

        TokenContractInstance = await helpers.utils.deployNewContractInstance(
            helpers,
            "RicoToken",
            {
                from: holder,
                arguments: [setup.settings.token.supply.toString(), []],
                gas: 6500000,
                gasPrice: helpers.solidity.gwei * 10
            }
        );

        TokenContractAddress = TokenContractInstance.receipt.contractAddress;

        await TokenContractInstance.methods.setup(
            helpers.addresses.Rico
        ).send({
            from: holder,  // initial token supply holder
        });

    });

    describe("Stage 1 - Deployment", function () {

        before(async function () {

        });

        it("Gas usage should be lower than network configuration gas.", function () {
            expect(this.ReversibleICO.receipt.gasUsed).to.be.below(helpers.networkConfig.gas);
        });

        it("Property deployerAddress should be " + deployerAddress, async function () {
            expect(await this.ReversibleICO.methods.deployerAddress().call()).to.be.equal(deployerAddress);
        });

        it("Property initialized should be false", async function () {
            expect(await this.ReversibleICO.methods.initialized().call()).to.be.equal(false);
        });

        it("Property frozen should be false", async function () {
            expect(await this.ReversibleICO.methods.frozen().call()).to.be.equal(false);
        });

        it("Property TokenContractAddress should be address(0x0)", async function () {
            expect(await this.ReversibleICO.methods.tokenContractAddress().call()).to.be.equal("0x0000000000000000000000000000000000000000");
        });

        it("Property whitelistControllerAddress should be address(0x0)", async function () {
            expect(await this.ReversibleICO.methods.whitelistControllerAddress().call()).to.be.equal("0x0000000000000000000000000000000000000000");
        });

    });

    describe("Stage 2 - Initialisation - init()", function () {

        before(async function () {

            currentBlock = await this.ReversibleICO.methods.getCurrentBlockNumber().call();

            // starts in one day
            commitPhaseStartBlock = parseInt(currentBlock, 10) + blocksPerDay * 1;

            // 22 days commiting
            commitPhaseBlockCount = blocksPerDay * 22;
            commitPhasePrice = helpers.solidity.ether * 0.002;

            // 12 x 30 day periods for buying
            StageCount = 12;
            StageBlockCount = blocksPerDay * 30;
            StagePriceIncrease = helpers.solidity.ether * 0.0001;

            commitPhaseEndBlock = commitPhaseStartBlock + commitPhaseBlockCount - 1;
  
            stageValidation.push( {
                start_block: commitPhaseStartBlock,
                end_block: commitPhaseEndBlock,
                token_price: commitPhasePrice
            });

            let lastStageBlockEnd = commitPhaseEndBlock;
            for (let i = 1; i <= StageCount; i++) {
    
                const startBlock = lastStageBlockEnd + 1;
                const endBlock = startBlock + StageBlockCount - 1;
                stageValidation.push( {
                    start_block: startBlock,
                    end_block: endBlock,
                    token_price: commitPhasePrice + (StagePriceIncrease * (i))
                });

                lastStageBlockEnd = endBlock;
            }
    
            // The buy phase starts on the subsequent block of the commitPhase's (stage0) endBlock
            BuyPhaseStartBlock = commitPhaseEndBlock + 1;
            BuyPhaseEndBlock = lastStageBlockEnd;
            // The duration of buyPhase in blocks
            BuyPhaseBlockCount = BuyPhaseEndBlock - BuyPhaseStartBlock;

            await this.ReversibleICO.methods.init(
                TokenContractAddress,        // address _tokenContractAddress
                whitelistControllerAddress,  // address _whitelistControllerAddress
                projectWalletAddress,        // address _projectWalletAddress
                commitPhaseStartBlock,       // uint256 _commitPhaseStartBlock
                commitPhaseBlockCount,       // uint256 _commitPhaseBlockCount,
                commitPhasePrice,            // uint256 _commitPhasePrice in wei
                StageCount,                  // uint8   _stageCount
                StageBlockCount,             // uint256 _stageBlockCount
                StagePriceIncrease           // uint256 _stagePriceIncrease in wei
            ).send({
                from: deployerAddress,  // deployer
                gas: 3000000
            });

        });

        describe("Contract settings", function () {

            it("Property initialized should be true", async function () {
                expect(await this.ReversibleICO.methods.initialized().call()).to.be.equal(true);
            });

            it("Property frozen should be false", async function () {
                expect(await this.ReversibleICO.methods.frozen().call()).to.be.equal(false);
            });

            it("Property TokenContractAddress should be deployed ERC777 Token Contract address", async function () {
                expect(await this.ReversibleICO.methods.tokenContractAddress().call()).to.be.equal(TokenContractAddress);
            });

            it("Property whitelistControllerAddress should be " + whitelistControllerAddress, async function () {
                expect(await this.ReversibleICO.methods.whitelistControllerAddress().call()).to.be.equal(whitelistControllerAddress);
            });

            it("Property projectWalletAddress should be " + projectWalletAddress, async function () {
                expect(await this.ReversibleICO.methods.projectWalletAddress().call()).to.be.equal(projectWalletAddress);
            });

            it("BuyPhaseEndBlock matches settings", async function () {
                expect(await this.ReversibleICO.methods.buyPhaseEndBlock().call()).to.be.equal(BuyPhaseEndBlock.toString());
            });

        });

        describe("Contract Stages", function () {

            let StageData;
            before(async function () {
                StageData = await this.ReversibleICO.methods.stages(0).call();
            });

            it("Stage Count is correct", async function () {
                expect(await this.ReversibleICO.methods.stageCount().call()).to.be.equal(StageCount.toString());
            });

            it("Commit Phase StartBlock matches settings", async function () {
                expect(StageData.startBlock.toString()).to.be.equal(commitPhaseStartBlock.toString());
            });

            it("Commit Phase duration is PhaseBlockCount", async function () {
                const count = StageData.endBlock - StageData.startBlock + 1;
                expect(count.toString()).to.be.equal(commitPhaseBlockCount.toString());
            });

            it("Commit Phase EndBlock matches settings", async function () {
                expect(StageData.endBlock).to.be.equal(commitPhaseEndBlock.toString());
            });

            it("Commit Phase Price matches settings", async function () {
                expect(StageData.tokenPrice.toString()).to.be.equal(commitPhasePrice.toString());
            });

            it("First Buy Stage settings are correct", async function () {
                const stageId = 0;
                const stageData = await this.ReversibleICO.methods.stages(stageId).call();
                const stage_block_start = stageData.startBlock;
                const stage_end_block = stageData.endBlock;
                const stage_token_price = stageData.tokenPrice;

                expect(stage_block_start).to.be.equal(stageValidation[stageId].start_block.toString());
                expect(stage_end_block).to.be.equal(stageValidation[stageId].end_block.toString());
                expect(stage_token_price).to.be.equal(stageValidation[stageId].token_price.toString());
            });

            it("Last Buy Stage settings are correct", async function () {
                const stageId = StageCount;
                const stageData = await this.ReversibleICO.methods.stages(stageId).call();
                const stage_block_start = stageData.startBlock;
                const stage_end_block = stageData.endBlock;
                const stage_token_price = stageData.tokenPrice;

                expect(stage_block_start).to.be.equal(stageValidation[stageId].start_block.toString());
                expect(stage_end_block).to.be.equal(stageValidation[stageId].end_block.toString());
                expect(stage_token_price).to.be.equal(stageValidation[stageId].token_price.toString());
            });

            it("Last Buy Stage end_block matches contract BuyPhaseEndBlock", async function () {
                const stageId = StageCount;
                const stageData = await this.ReversibleICO.methods.stages(stageId).call();
                const stage_end_block = stageData.endBlock;
                expect(stage_end_block).to.be.equal(BuyPhaseEndBlock.toString());
            });

        });

    });


    describe("Contract Methods", function () {

        describe("view getCurrentStage()", async function () {

            it("Returns stage 0 if at Commit Phase start_block", async function () {
                const stageId = 0;
                await helpers.utils.jumpToContractStage ( this.ReversibleICO, deployerAddress, stageId );
                expect( await this.ReversibleICO.methods.getCurrentStage().call() ).to.be.equal( stageId.toString() );
            });

            it("Returns stage 0 if at Commit Phase end_block", async function () {
                const stageId = 0;
                await helpers.utils.jumpToContractStage ( this.ReversibleICO, deployerAddress, stageId, true );
                expect( await this.ReversibleICO.methods.getCurrentStage().call() ).to.be.equal( stageId.toString() );
            });

            it("Returns stage 1 if at stage 1 start_block", async function () {
                const stageId = 1;
                await helpers.utils.jumpToContractStage ( this.ReversibleICO, deployerAddress, stageId );
                expect( await this.ReversibleICO.methods.getCurrentStage().call() ).to.be.equal( stageId.toString() );
            });

            it("Returns stage 1 if at stage 1 end_block", async function () {
                const stageId = 1;
                await helpers.utils.jumpToContractStage ( this.ReversibleICO, deployerAddress, stageId, true );
                expect( await this.ReversibleICO.methods.getCurrentStage().call() ).to.be.equal( stageId.toString() );
            });

            it("Returns stage 5 if at stage 5 start_block", async function () {
                const stageId = 5;
                await helpers.utils.jumpToContractStage ( this.ReversibleICO, deployerAddress, stageId );
                expect( await this.ReversibleICO.methods.getCurrentStage().call() ).to.be.equal( stageId.toString() );
            });

            it("Returns stage 5 if at stage 5 end_block", async function () {
                const stageId = 5;
                await helpers.utils.jumpToContractStage ( this.ReversibleICO, deployerAddress, stageId, true );
                expect( await this.ReversibleICO.methods.getCurrentStage().call() ).to.be.equal( stageId.toString() );
            });

            it("Returns last stage if at last stage start_block", async function () {
                const stageId = StageCount;
                await helpers.utils.jumpToContractStage ( this.ReversibleICO, deployerAddress, stageId );
                expect( await this.ReversibleICO.methods.getCurrentStage().call() ).to.be.equal( stageId.toString() );
            });

            it("Returns last stage if at last stage end_block", async function () {
                const stageId = StageCount;
                await helpers.utils.jumpToContractStage ( this.ReversibleICO, deployerAddress, stageId, true );
                expect( await this.ReversibleICO.methods.getCurrentStage().call() ).to.be.equal( stageId.toString() );
            });


            it("after last stage end_block reverts with \"Block outside of rICO period.\"", async function () {
                
                const stageData = await this.ReversibleICO.methods.stages(StageCount).call();
                await this.ReversibleICO.methods.jumpToBlockNumber(
                    stageData.endBlock + 1
                ).send({
                    from: deployerAddress, gas: 100000
                });

                await helpers.assertInvalidOpcode( async () => {
                    await this.ReversibleICO.methods.getCurrentStage().call()
                }, "Block outside of rICO period.");
            });

        });

        describe("view getStageAtBlock(uint256)", async function () {

            it("Returns stage 0 if getStageAtBlock( Commit Phase startBlock )", async function () {
                const stageId = 0;
                const stageData = await this.ReversibleICO.methods.stages(stageId).call();
                expect(
                    await this.ReversibleICO.methods.getStageAtBlock(stageData.startBlock).call()
                ).to.be.equal( stageId.toString() );
            });

            it("Returns stage 0 if getStageAtBlock( Commit Phase endBlock )", async function () {
                const stageId = 0;
                const stageData = await this.ReversibleICO.methods.stages(stageId).call();
                expect(
                    await this.ReversibleICO.methods.getStageAtBlock(stageData.endBlock).call()
                ).to.be.equal( stageId.toString() );
            });

            it("Returns stage 1 if getStageAtBlock( stage_1.startBlock )", async function () {
                const stageId = 1;
                const stageData = await this.ReversibleICO.methods.stages(stageId).call();
                expect(
                    await this.ReversibleICO.methods.getStageAtBlock(stageData.startBlock).call()
                ).to.be.equal( stageId.toString() );
            });

            it("Returns stage 1 if getStageAtBlock( stage_1.endBlock )", async function () {
                const stageId = 1;
                const stageData = await this.ReversibleICO.methods.stages(stageId).call();
                expect(
                    await this.ReversibleICO.methods.getStageAtBlock(stageData.endBlock).call()
                ).to.be.equal( stageId.toString() );
            });

            it("Returns stage 5 if getStageAtBlock( stage_5.startBlock )", async function () {
                const stageId = 5;
                const stageData = await this.ReversibleICO.methods.stages(stageId).call();
                expect(
                    await this.ReversibleICO.methods.getStageAtBlock(stageData.startBlock).call()
                ).to.be.equal( stageId.toString() );
            });

            it("Returns stage 5 if getStageAtBlock( stage_5.endBlock )", async function () {
                const stageId = 5;
                const stageData = await this.ReversibleICO.methods.stages(stageId).call();
                expect(
                    await this.ReversibleICO.methods.getStageAtBlock(stageData.endBlock).call()
                ).to.be.equal( stageId.toString() );
            });

            it("Returns stage last stage if getStageAtBlock( last_stage.startBlock )", async function () {
                const stageId = StageCount;
                const stageData = await this.ReversibleICO.methods.stages(stageId).call();
                expect(
                    await this.ReversibleICO.methods.getStageAtBlock(stageData.startBlock).call()
                ).to.be.equal( stageId.toString() );
            });

            it("Returns stage last stage if getStageAtBlock( last_stage.endBlock )", async function () {
                const stageId = StageCount;
                const stageData = await this.ReversibleICO.methods.stages(stageId).call();
                expect(
                    await this.ReversibleICO.methods.getStageAtBlock(stageData.endBlock).call()
                ).to.be.equal( stageId.toString() );
            });

            it("after last stage end_block reverts with \"Block outside of rICO period.\"", async function () {
                const stageData = await this.ReversibleICO.methods.stages(StageCount).call();
                await helpers.assertInvalidOpcode( async () => {
                    await this.ReversibleICO.methods.getStageAtBlock(stageData.endBlock + 1).call()
                }, "Block outside of rICO period.");
            });

        });

    });
});