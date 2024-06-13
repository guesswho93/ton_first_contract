import { Blockchain, SandboxContract, TreasuryContract, printTransactionFees } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Main } from '../wrappers/Main';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Main', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Main');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let main: SandboxContract<Main>;
    let admin: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        admin = await blockchain.treasury('admin');
        user = await blockchain.treasury('user')

        main = blockchain.openContract(Main.createFromConfig({
            admin: admin.address
        }, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await main.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: main.address,
            deploy: true,
            success: true,
        });
    });

    it('should accept funds and retain balance if sent >= 2 TON', async () => {
        const userBalanceBefore = await user.getBalance();
        const mainBalanceBefore = await main.getBalance();

        const sendFundsResult = await main.sendFunds(user.getSender(), toNano('2'));
        expect(sendFundsResult.transactions).toHaveTransaction({
            from: user.address,
            to: main.address,
            success: true
        });

        const userBalanceAfter = await user.getBalance();
        const mainBalanceAfter = await main.getBalance();

        expect(userBalanceAfter).toBeLessThan(userBalanceBefore);
        expect(mainBalanceAfter).toBeGreaterThan(mainBalanceBefore);
    });

    it('should allow admin to withdraw funds, retaining minimum balance', async () => {
        const initialDeposit = toNano('3');
        await main.sendFunds(admin.getSender(), initialDeposit);

        const adminBalanceBefore = await admin.getBalance();
        const mainBalanceBefore = await main.getBalance();

        console.log(`Admin balance before withdrawal: ${adminBalanceBefore}`);
        console.log(`Contract balance before withdrawal: ${mainBalanceBefore}`);

        const sendWithdrawResult = await main.sendWithdraw(admin.getSender());


        expect(sendWithdrawResult.transactions).toHaveTransaction({
            from: main.address,
            to: admin.address,
            success: true
        });

        const adminBalanceAfter = await admin.getBalance();
        const mainBalanceAfter = await main.getBalance();
        console.log(`Admin balance after withdrawal: ${adminBalanceAfter}`);
        console.log(`Contract balance after withdrawal: ${mainBalanceAfter}`);

        expect(mainBalanceAfter).toBeGreaterThanOrEqual(5000000);
        expect(adminBalanceAfter).toBeGreaterThan(adminBalanceBefore);
        
    });
});
