frappe.ui.form.on('Payment Entry', {
    on_submit:async function(frm){
        debugger;
        let references = frm.doc.references;
        let advance_id = null; 
        
        references.map((item) => {
            advance_id = item.reference_name
        })
        await update_status(advance_id)

    }
});


async function update_status(advance_id){
    frappe.call({
        method:"advance.overrides.payment_entry.payment_entry.update_status",
        args:{refresh_id:advance_id},
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