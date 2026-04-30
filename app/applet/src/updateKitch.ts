import fs from 'fs';

let content = fs.readFileSync('src/components/views/Kitchen.tsx', 'utf8');

const target = `                                              {localProduce && (
                                                <div className="flex flex-col text-[9px] text-emerald-800/70 leading-tight normal-case font-bold border-t border-emerald-200/50 pt-1.5 mt-0.5">
                                                  <span className="flex items-center gap-1"><MapPin size={8} /> {localProduce.farmerName}</span>
                                                  <span className="flex items-center gap-1"><ShoppingCart size={8} /> {localProduce.stock}{localProduce.unit} available</span>
                                                </div>
                                              )}`;

const replacement = `                                              {localProduce && (
                                                <div className={\`flex flex-col text-[9px] leading-tight normal-case font-bold border-t pt-1.5 mt-0.5 \${isAltAvailable ? 'text-emerald-800/70 border-emerald-200/50' : 'text-amber-800/70 border-amber-200/50'}\`}>
                                                  <span className="flex items-center gap-1"><MapPin size={8} /> {localProduce.farmerName}</span>
                                                  <span className="flex items-center gap-1"><ShoppingCart size={8} /> {localProduce.stock}{localProduce.unit} available</span>
                                                </div>
                                              )}
                                              {!isAltAvailable && !localProduce && (
                                                <div className="flex flex-col text-[8px] text-amber-800/70 leading-tight normal-case font-bold border-t border-amber-200/50 pt-1.5 mt-0.5">
                                                  <span>Not natively stocked</span>
                                                </div>
                                              )}`;

if (content.includes(target)) {
   content = content.replace(target, replacement);
   fs.writeFileSync('src/components/views/Kitchen.tsx', content);
   console.log('Successfully replaced!');
} else {
   console.log('Target not found in file!');
}
