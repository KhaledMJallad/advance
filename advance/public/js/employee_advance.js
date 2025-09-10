let lission_officer = null;
let petty_cash_amount = 0;
frappe.ui.form.on('Employee Advance', {
    before_cancel: async function (frm) {
        await change_wf_status(frm)
    },
});



async function change_wf_status(frm){
    if(!frm.doc.name) return
    frappe.call({
        method:"advance.overrides.employee_advance.employee_advance.change_status",
        args:{name:frm.doc.name},
        freeze: true,
        freeze_message: __("Update advance Please waite..."),
        callback:function(resp){
            if(resp.message.status === 201){
                frappe.show_alert({
                message: __("Advance Updated successfuly"),
                indicator: "green"
            }, 5);
            frm.reload_doc();
            }else{
                frappe.throw('An error has occurred. Please contact your administrator to resolve this issue.')
            }
        }
    })
}

