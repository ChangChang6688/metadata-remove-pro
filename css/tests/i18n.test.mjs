// i18n 语言切换回归: 修复 T() 闭包引用旧 LANG 的 bug
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const I = require('../js/i18n.js');

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail != null ? '  | ' + String(detail).slice(0, 80) : ''));
  if (!cond) fails++;
}

I.LANG = 'zh';
check('初始中文: T(clean_btn)', I.T('clean_btn') === '清理此文件', I.T('clean_btn'));
I.LANG = 'en';
check('切换英文后 T 即时生效', I.T('clean_btn') === 'Clean this file', I.T('clean_btn'));
check('英文模板参数', I.T('meta_list', { n: 3 }).indexOf('3') >= 0, I.T('meta_list', { n: 3 }));
I.LANG = 'zh';
check('切回中文生效', I.T('preset_normal') === '普通', I.T('preset_normal'));

console.log('');
console.log(fails === 0 ? '== 全部通过 ==' : '== ' + fails + ' 项失败 ==');
process.exit(fails ? 1 : 0);
