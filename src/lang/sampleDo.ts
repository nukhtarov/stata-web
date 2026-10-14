// Учебный do-файл — предзаполнение редактора.
export const SAMPLE_DO = `* import excel "C:\\path\\Dataset.xlsx", sheet("Лист1") firstrow clear
des
sum
corr Price Gini HOR Inflation URate Capital Euro_area EU Population Density Housing_stock Pop2HS GDP_PC_PPP GBL_10y MIR DMIR Mortgage_PC
reg Price Gini HOR Inflation URate Capital Euro_area EU Population Density Housing_stock Pop2HS GDP_PC_PPP GBL_10y MIR DMIR Mortgage_PC
linktest
ovtest
vif
twoway (scatter Price Gini) (lfit Price Gini)
acprplot Gini, lowess
capture drop ostatki
predict ostatki, resid
sum ostatki
kdensity ostatki, normal
swilk ostatki
rvfplot, yline(0)
estat imtest
estat hettest
`;
