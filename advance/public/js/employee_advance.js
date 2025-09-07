// let lission_officer = null;
// let petty_cash_amount = 0;
// frappe.ui.form.on('Employee Advance', {
//     onload:async function(frm){
//         if(!frm.doc.custom_project) return;
//         await get_project_data(frm)
//         if(frappe.user.has_role("System Manager")){
//             frm.set_value('employee', lission_officer);
//             frm.set_value('advance_amount', petty_cash_amount)
//             frm.set_value('purpose', "Project petty-cash advance Request")
//         }else{
//             let employee_number = await get_employee_number(frm)
//             if(employee_number === lission_officer){
//                 frm.set_value('employee', lission_officer);
//                 frm.set_value('advance_amount', petty_cash_amount)
//                 frm.set_value('purpose', "Project petty-cash advance Request")
//             }else{
//                 frappe.throw("You are attempting to access the Advance page in an invalid manner. Please contact your administrator to resolve this issue.")
//             }
//         }
        
//     },
// });



// async function get_employee_number(frm){
//     const respose = await frappe.call({
//         method:"advance.new_employee_advnce.doctype.food_expenses.food_expenses.get_employee_number",
//         args:{user:frappe.session.user}
//     });
//     console.log(respose)
//     if(respose.message.status === 404){
//         frappe.throw(respose.message.message)
//     }else{
//         respose.message.data.map((item) => {
//             employee_number = item.name
//         })

//         return employee_number

//     }
// }

// async function get_project_data(frm){
//     const response = await frappe.call({
//         method:"advance.new_employee_advnce.doctype.food_expenses.food_expenses.get_project_data",
//         args:{project_name:frm.doc.custom_project}
//     });
//     if(response.message.status === 404){
//         frappe.throw(response.message.message)
//     }else{
//         response.message.data.map((item) => {
//             petty_cash_amount = item.custom_pettycash_amount;
//             lission_officer = item.custom_liaison_officer
//         })
//     }
    
// }




