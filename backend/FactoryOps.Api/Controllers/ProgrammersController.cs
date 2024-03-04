using FactoryOps.Api.Database.Models;
using FactoryOps.Api.Database.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace FactoryOps.Api.Controllers;

[ApiController]
[Route("programmers")]
public class ProgrammesController(IRepository<Programmer> programmersRepository) : ControllerBase
{
	[HttpGet]
	public ActionResult<IAsyncEnumerable<Programmer>> GetAll() => Ok(programmersRepository.GetAll());

	[HttpGet]
	[Route("{id}")]
	public async Task<ActionResult<Programmer>> Get(int id) => Ok(await programmersRepository.Get(id));

	
	[HttpPost]
	[Route("insertOrUpdate")]
	public async Task<IActionResult> InsertOrUpdate ([FromBody] Programmer programmer)
	{
		await programmersRepository.InsertOrUpdate(programmer);
		return Ok();
	}

	[HttpDelete]
	[Route("delete")]
	public async Task<IActionResult> Delete([FromBody] Programmer programmer)
	{
		await programmersRepository.Delete(programmer);
		return Ok();
	}

}